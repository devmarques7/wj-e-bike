/**
 * In-chat guided diagnosis flow (deterministic, 0 AI tokens).
 *
 * The assistant asks one question at a time, offers quick answers and stores
 * every answer as a removable tag. Removing a tag rewinds the flow to that
 * question. The AI is only called when the rider clearly steps out of the flow.
 */
import {
  SYMPTOMS,
  getSymptom,
  type DiagnosisQuestion,
  type SymptomDefinition,
  type SymptomId,
} from "./diagnosis";

export interface DiagnosisTag {
  /** question id, or "symptom" / "notes" */
  id: string;
  label: string;
  question: string;
  answer: string;
}

export type DiagnosisPhase = "symptom" | "questions" | "notes" | "done";

export interface DiagnosisSession {
  symptomId: SymptomId | null;
  phase: DiagnosisPhase;
  /** index of the question currently being asked */
  step: number;
  tags: DiagnosisTag[];
}

export const NOTES_QUESTION = "Anything else the mechanic should know?";
export const NOTES_OPTIONS = ["No, that's all", "It's urgent", "I have photos"];

export function newSession(symptomId?: SymptomId | null): DiagnosisSession {
  return {
    symptomId: symptomId ?? null,
    phase: symptomId ? "questions" : "symptom",
    step: 0,
    tags: symptomId
      ? [
          {
            id: "symptom",
            label: getSymptom(symptomId).label,
            question: "What is wrong?",
            answer: getSymptom(symptomId).label,
          },
        ]
      : [],
  };
}

export function symptomOf(session: DiagnosisSession): SymptomDefinition | null {
  return session.symptomId ? getSymptom(session.symptomId) : null;
}

export function questionsOf(session: DiagnosisSession): DiagnosisQuestion[] {
  return symptomOf(session)?.questions ?? [];
}

export interface DiagnosisPrompt {
  content: string;
  options: string[];
}

/** The question the assistant should ask right now. */
export function currentPrompt(session: DiagnosisSession): DiagnosisPrompt | null {
  if (session.phase === "symptom") {
    return {
      content: "What is happening with your bike? Pick the closest one — or describe it.",
      options: SYMPTOMS.map((s) => s.label),
    };
  }
  if (session.phase === "questions") {
    const q = questionsOf(session)[session.step];
    if (!q) return null;
    return { content: q.question, options: q.options };
  }
  if (session.phase === "notes") {
    return { content: NOTES_QUESTION, options: NOTES_OPTIONS };
  }
  return null;
}

export function progressOf(session: DiagnosisSession) {
  const total = questionsOf(session).length + 2; // symptom + questions + notes
  const done = session.tags.length;
  return { done, total: Math.max(total, done) };
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

/** Match free text against the offered options (exact-ish, then contains). */
export function matchOption(text: string, options: string[]): string | null {
  const t = norm(text);
  if (!t) return null;
  const exact = options.find((o) => norm(o) === t);
  if (exact) return exact;
  const partial = options.find((o) => norm(o).includes(t) || t.includes(norm(o)));
  return partial ?? null;
}

/**
 * Detects a message that is not an answer to the current question — a real
 * question, a topic change or a request. Only these escalate to the model.
 */
export function isOffFlow(text: string, currentOptions: string[]): boolean {
  if (matchOption(text, currentOptions)) return false;
  const t = norm(text);
  if (!t) return true;
  const asksSomething =
    text.includes("?") ||
    /\b(how|what|why|when|where|which|can you|do you|is it|does|price|cost|plan|covered|quanto|como|porque|por que|qual|quando|onde|posso|voce|pode)\b/.test(t);
  const wordCount = t.split(/\s+/).length;
  // Short statements are treated as valid free-text answers (0 tokens).
  return asksSomething || wordCount > 18;
}

/** Advance the session after a valid answer. */
export function applyAnswer(session: DiagnosisSession, answer: string): DiagnosisSession {
  if (session.phase === "symptom") {
    const matched =
      SYMPTOMS.find((s) => norm(s.label) === norm(answer)) ??
      SYMPTOMS.find((s) => norm(answer).includes(norm(s.label)));
    const symptom = matched ?? getSymptom("other");
    return {
      symptomId: symptom.id,
      phase: "questions",
      step: 0,
      tags: [
        ...session.tags,
        { id: "symptom", label: symptom.label, question: "What is wrong?", answer: symptom.label },
      ],
    };
  }

  if (session.phase === "questions") {
    const questions = questionsOf(session);
    const q = questions[session.step];
    if (!q) return { ...session, phase: "notes" };
    const tags = [
      ...session.tags.filter((tag) => tag.id !== q.id),
      { id: q.id, label: answer, question: q.question, answer },
    ];
    const nextStep = session.step + 1;
    return {
      ...session,
      tags,
      step: nextStep,
      phase: nextStep >= questions.length ? "notes" : "questions",
    };
  }

  if (session.phase === "notes") {
    const skip = /^(no|nao|não|nothing|thats all|that's all|no thats all|no, that's all)/i.test(answer.trim());
    return {
      ...session,
      phase: "done",
      tags: skip
        ? session.tags
        : [...session.tags, { id: "notes", label: answer, question: NOTES_QUESTION, answer }],
    };
  }

  return session;
}

/** Remove a tag and rewind the flow to that question. */
export function removeTag(session: DiagnosisSession, tagId: string): DiagnosisSession {
  if (tagId === "symptom") {
    return { symptomId: null, phase: "symptom", step: 0, tags: [] };
  }
  if (tagId === "notes") {
    return { ...session, phase: "notes", tags: session.tags.filter((t) => t.id !== "notes") };
  }
  const questions = questionsOf(session);
  const index = questions.findIndex((q) => q.id === tagId);
  return {
    ...session,
    tags: session.tags.filter((t) => t.id !== tagId),
    step: index >= 0 ? index : session.step,
    phase: "questions",
  };
}

/** Answers collected for the briefing builder. */
export function answersOf(session: DiagnosisSession) {
  return session.tags
    .filter((t) => t.id !== "symptom" && t.id !== "notes")
    .map((t) => ({ question: t.question, answer: t.answer }));
}

export function notesOf(session: DiagnosisSession) {
  return session.tags.find((t) => t.id === "notes")?.answer ?? "";
}
