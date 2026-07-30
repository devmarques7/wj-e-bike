/**
 * AI "judge" for free-text answers inside the guided diagnosis.
 *
 * When the rider writes a long description instead of tapping one of the quick
 * answers, the model reads it once, extracts the keywords that carry the real
 * context and maps them onto the pending diagnosis questions. Those become the
 * answer tags — then the deterministic flow takes over again (0 tokens).
 */
import { supabase } from "@/integrations/supabase/client";
import { SYMPTOMS } from "./diagnosis";
import {
  NOTES_QUESTION,
  currentPrompt,
  questionsOf,
  type DiagnosisSession,
} from "./diagnosisFlow";

export interface JudgeResult {
  /** Short reply to the rider (may be empty). */
  reply: string;
  /** Symptom label picked from the catalog, when the flow still needs one. */
  symptom: string | null;
  /** questionId -> chosen answer (must be one of the offered options). */
  answers: Record<string, string>;
  /** Context keywords extracted from the free text. */
  keywords: string[];
  /** Cleaned-up description to store as the notes tag. */
  notes: string | null;
}

const stripFences = (s: string) =>
  s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

function parseJudge(raw: string): JudgeResult | null {
  if (!raw) return null;
  const text = stripFences(raw.trim());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply : "",
      symptom: typeof parsed.symptom === "string" && parsed.symptom ? parsed.symptom : null,
      answers:
        parsed.answers && typeof parsed.answers === "object" && !Array.isArray(parsed.answers)
          ? Object.fromEntries(
              Object.entries(parsed.answers as Record<string, unknown>)
                .filter(([, v]) => typeof v === "string" && v)
                .map(([k, v]) => [k, String(v)]),
            )
          : {},
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k: unknown) => typeof k === "string" && k).slice(0, 6)
        : [],
      notes: typeof parsed.notes === "string" && parsed.notes ? parsed.notes : null,
    };
  } catch {
    return null;
  }
}

/** One cheap AI call: judge the free text and map it onto the flow. */
export async function judgeFreeText(
  session: DiagnosisSession,
  text: string,
): Promise<JudgeResult | null> {
  const active = currentPrompt(session);
  const pending = questionsOf(session)
    .slice(session.phase === "questions" ? session.step : 0)
    .map((q) => `${q.id}: ${q.question} [${q.options.join(" | ")}]`)
    .join("\n");

  const needsSymptom = session.phase === "symptom";
  const instructions = [
    "You are a bike service intake analyst. Read the rider's message and extract the diagnostic context.",
    needsSymptom
      ? `Pick the closest symptom from: ${SYMPTOMS.map((s) => s.label).join(" | ")}.`
      : "Symptom is already known.",
    pending ? `Answer as many of these questions as the message supports. Use EXACTLY one of the listed options for each.\n${pending}` : "",
    `Current question: ${active?.content ?? ""}`,
    `Notes question: ${NOTES_QUESTION}`,
    "Reply with JSON only, no prose:",
    '{"reply":"one short sentence acknowledging the problem","symptom":"label or null","answers":{"question_id":"option"},"keywords":["3-6 short keywords from the message"],"notes":"one-line cleaned description"}',
    `Rider message: """${text.slice(0, 800)}"""`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { data, error } = await supabase.functions.invoke("bike-assistant", {
      body: {
        messages: [{ role: "user", content: instructions }],
        skills: [],
        assistantName: "Intake analyst",
        tone: "concise",
      },
    });
    if (error || data?.error) return null;
    return parseJudge(data?.content ?? "");
  } catch {
    return null;
  }
}