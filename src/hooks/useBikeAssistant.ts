import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveLocalIntent, type AssistantAction } from "@/lib/ai/intents";
import { useAuth } from "@/contexts/AuthContext";
import { buildBriefing, getSymptom, type SymptomId } from "@/lib/ai/diagnosis";
import { saveBriefing } from "@/lib/ai/diagnosis";
import {
  answersOf,
  applyAnswer,
  currentPrompt,
  isOffFlow,
  matchOption,
  newModeSession,
  notesOf,
  progressOf,
  removeTag,
  symptomOf,
  type DiagnosisSession,
} from "@/lib/ai/diagnosisFlow";
import {
  BACK_TO_DAYS,
  NO_FIT_OPTION,
  bookingPrompt,
  isUrgentAnswer,
  matchDay,
  matchSlot,
  matchUpcomingDay,
  periodFromAnswer,
  type BookingSession,
} from "@/lib/ai/bookingFlow";
import {
  bookSlot,
  createAppointmentRequest,
  dayLabel,
  fetchAvailability,
  fetchServiceTypes,
  resolveServiceType,
} from "@/lib/scheduling/availability";
import {
  ASSISTANT_CONFIG_STORAGE_KEY,
  ASSISTANT_SKILLS,
  DEFAULT_ASSISTANT_CONFIG,
  type AssistantConfig,
  type AssistantSkillId,
} from "@/lib/ai/skills";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** "local" = answered by the deterministic skill layer (0 AI credits) */
  source?: "local" | "ai";
  action?: AssistantAction;
  /** Quick answers rendered as chips (diagnosis flow). */
  options?: string[];
}

function loadConfig(): AssistantConfig {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT_CONFIG;
  try {
    const raw = window.localStorage.getItem(ASSISTANT_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_ASSISTANT_CONFIG;
    return { ...DEFAULT_ASSISTANT_CONFIG, ...JSON.parse(raw) } as AssistantConfig;
  } catch {
    return DEFAULT_ASSISTANT_CONFIG;
  }
}

/** Minimum time the assistant "analyses" before answering (feels deliberate). */
const MIN_THINKING_MS = 2000;
/** Diagnosis steps are deterministic — keep them snappy. */
const FLOW_THINKING_MS = 550;

const THINKING_PHRASES = [
  "Reading your request...",
  "Checking your bike data...",
  "Looking at your plan coverage...",
  "Matching the best flow for you...",
  "Reviewing service history...",
  "Comparing available options...",
  "Almost there, refining the answer...",
];

function pickPhrases() {
  const shuffled = [...THINKING_PHRASES].sort(() => Math.random() - 0.5);
  return [THINKING_PHRASES[0], ...shuffled.filter((p) => p !== THINKING_PHRASES[0])];
}

const uid = () => crypto.randomUUID();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useBikeAssistant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [config, setConfig] = useState<AssistantConfig>(loadConfig);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "thinking" | "answering">("idle");
  const [thinkingPhrase, setThinkingPhrase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [savedCalls, setSavedCalls] = useState(0);
  const [diagnosis, setDiagnosis] = useState<DiagnosisSession | null>(null);
  const diagnosisRef = useRef<DiagnosisSession | null>(null);
  const [booking, setBooking] = useState<BookingSession | null>(null);
  const bookingRef = useRef<BookingSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    diagnosisRef.current = diagnosis;
  }, [diagnosis]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ASSISTANT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch { /* ignore */ }
  }, [config]);

  const updateConfig = useCallback((patch: Partial<AssistantConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleSkill = useCallback((id: AssistantSkillId) => {
    setConfig((prev) => ({
      ...prev,
      enabledSkills: prev.enabledSkills.includes(id)
        ? prev.enabledSkills.filter((s) => s !== id)
        : [...prev.enabledSkills, id],
    }));
  }, []);

  const activeSkills = useMemo(
    () => ASSISTANT_SKILLS.filter((s) => config.enabledSkills.includes(s.id)),
    [config.enabledSkills],
  );

  const pushAssistant = useCallback(
    (content: string, extra: Partial<AssistantMessage> = {}) => {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content, source: "local", ...extra },
      ]);
    },
    [],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus("idle");
    setDiagnosis(null);
    diagnosisRef.current = null;
    setBooking(null);
    bookingRef.current = null;
  }, []);

  /* ---------------- Diagnosis flow (deterministic) ---------------- */

  const setSession = useCallback((session: DiagnosisSession | null) => {
    diagnosisRef.current = session;
    setDiagnosis(session);
  }, []);

  const setBookingSession = useCallback((session: BookingSession | null) => {
    bookingRef.current = session;
    setBooking(session);
  }, []);

  /** Ask the current question of a session (or finish it). */
  const askCurrent = useCallback(
    (session: DiagnosisSession, prefix?: string) => {
      const prompt = currentPrompt(session);
      if (!prompt) return;
      const { done, total } = progressOf(session);
      const head = prefix ? `${prefix}\n\n` : "";
      pushAssistant(`${head}${prompt.content}`, {
        options: prompt.options,
        source: "local",
      });
      void done;
      void total;
    },
    [pushAssistant],
  );

  /** Ask the current booking question. */
  const askBooking = useCallback(
    (session: BookingSession, prefix?: string) => {
      const prompt = bookingPrompt(session);
      if (!prompt) return;
      pushAssistant(`${prefix ? `${prefix}\n\n` : ""}${prompt.content}`, {
        options: prompt.options,
        source: "local",
      });
    },
    [pushAssistant],
  );

  /** After the diagnosis: load real availability and offer conflict-free slots. */
  const startBooking = useCallback(
    async (opts: { serviceHint: string; urgent: boolean; notes: string }) => {
      const types = await fetchServiceTypes();
      const type = resolveServiceType(types, opts.serviceHint);
      if (!type) {
        pushAssistant(
          "I couldn't load the service catalogue right now. Open the booking page and I'll keep your briefing ready.",
          { action: { type: "navigate", to: "/dashboard/service", label: "Open booking" } },
        );
        return;
      }
      const availability = await fetchAvailability(type.id, 7);
      const session: BookingSession = {
        phase: availability.length ? "day" : "request_period",
        serviceTypeId: type.id,
        serviceName: type.name,
        availability,
        date: null,
        urgent: opts.urgent,
        notes: opts.notes,
        period: null,
        preferredDate: null,
      };
      setBookingSession(session);
      askBooking(
        session,
        availability.length ? undefined : "There are no free slots in the next 7 days.",
      );
    },
    [askBooking, pushAssistant, setBookingSession],
  );

  const finishDiagnosis = useCallback(
    async (session: DiagnosisSession) => {
      const symptom = symptomOf(session) ?? getSymptom("other");
      const answers = answersOf(session);
      const notes = notesOf(session);
      const briefing = buildBriefing(symptom, answers, notes);
      saveBriefing(briefing);
      setSession({ ...session, phase: "done" });
      const urgent =
        Boolean(symptom.urgent) ||
        answers.some((a) => /urgent|asap|can'?t ride|unsafe/i.test(`${a.answer}`)) ||
        /urgent/i.test(notes);
      pushAssistant(
        `Thank you — your **${symptom.label.toLowerCase()}** briefing is complete${urgent ? " · priority HIGH" : ""}. Let me check the free slots...`,
      );
      await startBooking({ serviceHint: symptom.serviceHint, urgent, notes: briefing.summary });
    },
    [pushAssistant, setSession, startBooking],
  );

  const startDiagnosis = useCallback(
    (symptomId?: SymptomId | null) => {
      const session = newModeSession(symptomId ?? null);
      setSession(session);
      const symptom = symptomId ? getSymptom(symptomId) : null;
      const intro = symptom
        ? `Let's sort out your **${symptom.label.toLowerCase()}**.`
        : "Let's get your bike booked in.";
      askCurrent(session, intro);
    },
    [askCurrent, setSession],
  );

  const cancelDiagnosis = useCallback(() => {
    setSession(null);
    setBookingSession(null);
    pushAssistant("Diagnosis cancelled. Ask me anything else whenever you want.");
  }, [pushAssistant, setSession, setBookingSession]);

  /* ---------------- Booking answers (deterministic) ---------------- */

  const handleBookingAnswer = useCallback(
    async (session: BookingSession, answer: string) => {
      const wantsRequest = answer.toLowerCase().includes(NO_FIT_OPTION.toLowerCase().slice(0, 12));

      if (session.phase === "day") {
        if (wantsRequest) {
          const next = { ...session, phase: "request_period" as const };
          setBookingSession(next);
          askBooking(next);
          return;
        }
        const day = matchDay(session, answer);
        if (!day) return askBooking(session, "I didn't catch that day.");
        const next = { ...session, date: day.date, phase: "slot" as const };
        setBookingSession(next);
        askBooking(next);
        return;
      }

      if (session.phase === "slot") {
        if (answer.toLowerCase().includes(BACK_TO_DAYS.toLowerCase().slice(0, 10))) {
          const next = { ...session, phase: "day" as const, date: null };
          setBookingSession(next);
          askBooking(next);
          return;
        }
        if (wantsRequest) {
          const next = { ...session, phase: "request_period" as const };
          setBookingSession(next);
          askBooking(next);
          return;
        }
        const slot = matchSlot(session, answer);
        if (!slot || !session.date) return askBooking(session, "That time isn't in the list.");
        try {
          await bookSlot({
            userId: user!.id,
            serviceTypeId: session.serviceTypeId,
            date: session.date,
            slot,
            urgent: session.urgent,
            notes: session.notes,
          });
          setBookingSession(null);
          pushAssistant(
            `Booked — **${dayLabel(session.date)} at ${slot.start}** for ${session.serviceName}. Your repair briefing is attached to the appointment.`,
            { action: { type: "navigate", to: "/dashboard/service", label: "See my appointment" } },
          );
        } catch {
          const next = { ...session, phase: "day" as const, date: null };
          setBookingSession(next);
          askBooking(next, "That slot was just taken. Let's pick another one.");
        }
        return;
      }

      if (session.phase === "request_period") {
        const next = { ...session, period: periodFromAnswer(answer), phase: "request_day" as const };
        setBookingSession(next);
        askBooking(next);
        return;
      }

      if (session.phase === "request_day") {
        const next = {
          ...session,
          preferredDate: matchUpcomingDay(answer),
          phase: "request_urgency" as const,
        };
        setBookingSession(next);
        askBooking(next);
        return;
      }

      if (session.phase === "request_urgency") {
        const urgent = isUrgentAnswer(answer) || session.urgent;
        try {
          await createAppointmentRequest({
            userId: user!.id,
            serviceTypeId: session.serviceTypeId,
            period: session.period ?? "any",
            preferredDate: session.preferredDate,
            urgent,
            notes: session.notes,
          });
          setBookingSession(null);
          pushAssistant(
            `Scheduling **request** sent (not a confirmed booking yet) — ${session.preferredDate ? dayLabel(session.preferredDate) : "any day"}, ${session.period ?? "any"} time${urgent ? ", urgent" : ""}.\nOur team will fit you in and confirm as soon as a slot opens.`,
            { action: { type: "navigate", to: "/dashboard/service", label: "See my requests" } },
          );
        } catch {
          setBookingSession(null);
          pushAssistant("I couldn't send the request. Try again from the booking page.", {
            action: { type: "navigate", to: "/dashboard/service", label: "Open booking" },
          });
        }
      }
    },
    [askBooking, pushAssistant, setBookingSession, user],
  );

  /** Removing an answer tag rewinds the flow and re-asks that question. */
  const removeDiagnosisTag = useCallback(
    (tagId: string) => {
      const session = diagnosisRef.current;
      if (!session) return;
      const tag = session.tags.find((t) => t.id === tagId);
      const next = removeTag(session, tagId);
      setSession(next);
      askCurrent(
        next,
        `You removed the answer${tag ? ` “${tag.answer}”` : ""}. Let's redo that step.`,
      );
    },
    [askCurrent, setSession],
  );

  /* ---------------- Send ---------------- */

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || status !== "idle") return;
      setError(null);

      setMessages((prev) => [...prev, { id: uid(), role: "user", content: prompt }]);
      const history = [...messages, { id: uid(), role: "user" as const, content: prompt }];
      setStatus("thinking");

      /* ---------- 0a. Active booking flow: 0 tokens ---------- */
      const bookingSession = bookingRef.current;
      if (bookingSession && bookingSession.phase !== "done") {
        await wait(FLOW_THINKING_MS);
        await handleBookingAnswer(bookingSession, prompt);
        setSavedCalls((n) => n + 1);
        setStatus("idle");
        return;
      }

      /* ---------- 0. Active diagnosis flow: 0 tokens ---------- */
      const session = diagnosisRef.current;
      if (session && session.phase !== "done") {
        const active = currentPrompt(session);
        const options = active?.options ?? [];
        const matched = matchOption(prompt, options);

        if (!matched && isOffFlow(prompt, options)) {
          // Off-flow → let the model answer, then resume exactly where we were.
          try {
            const { data, error: fnError } = await supabase.functions.invoke("bike-assistant", {
              body: {
                messages: [{ role: "user", content: prompt }],
                skills: config.enabledSkills,
                assistantName: config.name,
                tone: config.tone,
              },
            });
            if (fnError) throw fnError;
            if (data?.error) throw new Error(data.error);
            pushAssistant(data?.content ?? "", { source: "ai" });
          } catch {
            pushAssistant("I couldn't check that right now — let's keep the diagnosis going.");
          }
          await wait(200);
          askCurrent(diagnosisRef.current!, "Back to the diagnosis:");
          setStatus("idle");
          return;
        }

        await wait(FLOW_THINKING_MS);
        const next = applyAnswer(session, matched ?? prompt);
        setSession(next);
        setSavedCalls((n) => n + 1);
        if (next.phase === "done") await finishDiagnosis(next);
        else askCurrent(next);
        setStatus("idle");
        return;
      }

      const phrases = pickPhrases();
      setThinkingPhrase(phrases[0]);
      let phraseIndex = 0;
      const phraseTimer = window.setInterval(() => {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setThinkingPhrase(phrases[phraseIndex]);
      }, 900);
      const startedAt = Date.now();
      const waitMinimum = async () => {
        const remaining = MIN_THINKING_MS - (Date.now() - startedAt);
        if (remaining > 0) await wait(remaining);
      };

      /* ---------- 1. Deterministic layer: no AI credits ---------- */
      try {
        const local = await resolveLocalIntent(prompt, {
          userId: user?.id ?? null,
          enabledSkills: config.enabledSkills,
          assistantName: config.name,
        });
        if (local?.content) {
          await waitMinimum();
          window.clearInterval(phraseTimer);
          setThinkingPhrase("");
          // A diagnosis intent now runs entirely in the chat.
          if (local.action?.type === "diagnose") {
            pushAssistant(local.content, { source: "local" });
            setSavedCalls((n) => n + 1);
            setStatus("idle");
            startDiagnosis(local.action.symptom ?? null);
            return;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: local.content,
              source: "local",
              action: local.action,
            },
          ]);
          setSavedCalls((n) => n + 1);
          setStatus("idle");
          return;
        }
      } catch {
        /* fall through to the AI */
      }

      /* ---------- 2. Escalate to the model ---------- */
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = window.setTimeout(
        () => controller.abort(),
        Math.max(5, config.maxResponseSeconds) * 1000,
      );

      try {
        const { data, error: fnError } = await supabase.functions.invoke("bike-assistant", {
          body: {
            messages: history.map(({ role, content }) => ({ role, content })),
            skills: config.enabledSkills,
            assistantName: config.name,
            tone: config.tone,
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        await waitMinimum();
        setStatus("answering");
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: data?.content ?? "", source: "ai" },
        ]);
      } catch (e: any) {
        await waitMinimum();
        const message =
          e?.name === "AbortError"
            ? `No answer within ${config.maxResponseSeconds}s. Try again.`
            : e?.message === "rate_limited"
              ? "Too many requests — please wait a moment."
              : e?.message === "credits_exhausted"
                ? "AI credits exhausted. Add credits to continue."
                : "The assistant is unavailable right now.";
        setError(message);
      } finally {
        window.clearTimeout(timeout);
        window.clearInterval(phraseTimer);
        setThinkingPhrase("");
        abortRef.current = null;
        setStatus("idle");
      }
    },
    [askCurrent, config, finishDiagnosis, handleBookingAnswer, messages, pushAssistant, setSession, startDiagnosis, status, user?.id],
  );

  const runAction = useCallback(
    (action: AssistantAction) => {
      if (action.type === "navigate") navigate(action.to);
      else if (action.type === "external") window.location.href = action.href;
      else if (action.type === "diagnose") startDiagnosis(action.symptom ?? null);
    },
    [navigate, startDiagnosis],
  );

  return {
    config,
    updateConfig,
    toggleSkill,
    activeSkills,
    messages,
    status,
    thinkingPhrase,
    error,
    send,
    reset,
    runAction,
    savedCalls,
    diagnosis,
    diagnosisProgress: diagnosis ? progressOf(diagnosis) : null,
    startDiagnosis,
    removeDiagnosisTag,
    cancelDiagnosis,
    booking,
  };
}
