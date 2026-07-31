/**
 * WJ bike condition assessment model.
 *
 * A short guided inspection: one question per wear point plus the bike origin.
 * Every answer maps to an honest score band. Parts that are not factory-new
 * can never score above their band cap (refurbished/adjusted parts are capped
 * at 80%), so the final condition stays realistic.
 */

export type AssessmentKey =
  | "origin"
  | "battery"
  | "brakes"
  | "drivetrain"
  | "tyres"
  | "frame"
  | "compliance";

export interface AssessmentOption {
  /** Stored answer id. */
  id: string;
  label: string;
  hint?: string;
  /** Score awarded for this answer (0-100). Never above the honest cap. */
  score: number;
  /** Hard cap applied to every other point (used by the origin question). */
  globalCap?: number;
}

export interface AssessmentQuestion {
  key: AssessmentKey;
  label: string;
  question: string;
  /** Weight in the overall condition score. */
  weight: number;
  options: AssessmentOption[];
}

/** Condition bands shared by parts questions. */
const PART_OPTIONS = (labels: {
  neu: string;
  adjusted: string;
  used: string;
  worn: string;
  faulty: string;
}): AssessmentOption[] => [
  { id: "new", label: labels.neu, hint: "Factory new / never used", score: 100 },
  { id: "adjusted", label: labels.adjusted, hint: "Reused or re-adjusted — capped at 80%", score: 80 },
  { id: "used", label: labels.used, hint: "Normal wear, still within spec", score: 62 },
  { id: "worn", label: labels.worn, hint: "Near end of life, plan a replacement", score: 38 },
  { id: "faulty", label: labels.faulty, hint: "Must be replaced now", score: 12 },
];

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    key: "origin",
    label: "Origin",
    question: "First: is this bike new or second-hand?",
    weight: 0,
    options: [
      { id: "new", label: "New bike", hint: "First owner, factory condition", score: 100, globalCap: 100 },
      {
        id: "refurbished",
        label: "Refurbished by WJ",
        hint: "Second-hand, fully serviced — capped at 80%",
        score: 80,
        globalCap: 80,
      },
      {
        id: "second_hand",
        label: "Second-hand",
        hint: "Used bike, no full refurbishment — capped at 75%",
        score: 75,
        globalCap: 75,
      },
    ],
  },
  {
    key: "battery",
    label: "Battery",
    question: "Battery & charging: how does the pack behave?",
    weight: 0.24,
    options: PART_OPTIONS({
      neu: "New pack, full range",
      adjusted: "Replaced / reconditioned pack",
      used: "Holds charge, slight range loss",
      worn: "Noticeable range loss",
      faulty: "Fails to charge or holds no range",
    }),
  },
  {
    key: "brakes",
    label: "Brakes",
    question: "Brakes: pads, discs and lever feel?",
    weight: 0.2,
    options: PART_OPTIONS({
      neu: "New pads & true discs",
      adjusted: "Re-adjusted / bled, pads reused",
      used: "Good bite, pads over half life",
      worn: "Pads thin or discs scored",
      faulty: "Unsafe — no reliable braking",
    }),
  },
  {
    key: "drivetrain",
    label: "Drivetrain",
    question: "Drivetrain: chain, cassette and shifting?",
    weight: 0.18,
    options: PART_OPTIONS({
      neu: "New chain & cassette",
      adjusted: "Cleaned & re-indexed, parts reused",
      used: "Chain wear under 0.5%, shifts fine",
      worn: "Chain wear 0.5–0.75%, skipping",
      faulty: "Worn out / broken drivetrain",
    }),
  },
  {
    key: "tyres",
    label: "Tyres",
    question: "Tyres & wheels: tread, pressure and trueness?",
    weight: 0.14,
    options: PART_OPTIONS({
      neu: "New tyres, wheels true",
      adjusted: "Wheels re-trued / tyres re-seated",
      used: "Good tread, holds pressure",
      worn: "Low tread or slow puncture",
      faulty: "Bald, cut or buckled wheel",
    }),
  },
  {
    key: "frame",
    label: "Frame & bolts",
    question: "Frame, torque and alignment?",
    weight: 0.14,
    options: PART_OPTIONS({
      neu: "Flawless frame, torque checked",
      adjusted: "Re-torqued / cosmetic repair done",
      used: "Minor scratches, all solid",
      worn: "Play in headset or loose parts",
      faulty: "Crack, dent or misalignment",
    }),
  },
  {
    key: "compliance",
    label: "Service cycle",
    question: "Service history against the 3-month cycle?",
    weight: 0.1,
    options: [
      { id: "new", label: "Serviced now / up to date", hint: "Within the cycle", score: 100 },
      { id: "adjusted", label: "Serviced late but complete", hint: "Capped at 80%", score: 80 },
      { id: "used", label: "One cycle missed", score: 60 },
      { id: "worn", label: "Two or more cycles missed", score: 35 },
      { id: "faulty", label: "Never serviced", score: 10 },
    ],
  },
];

export const PART_QUESTIONS = ASSESSMENT_QUESTIONS.filter((q) => q.key !== "origin");

export type AssessmentAnswers = Partial<Record<AssessmentKey, string>>;

export interface AssessmentResult {
  scores: Record<string, number>;
  overall: number;
  label: string;
  cap: number;
  isSecondHand: boolean;
  origin: string;
}

export function conditionLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Very good";
  if (score >= 60) return "Good";
  if (score >= 45) return "Fair";
  if (score >= 30) return "Poor";
  return "Critical";
}

/** Honest scoring: per-point band, capped by the bike origin, weighted average. */
export function computeAssessment(answers: AssessmentAnswers): AssessmentResult {
  const originQ = ASSESSMENT_QUESTIONS[0];
  const originOpt =
    originQ.options.find((o) => o.id === answers.origin) ?? originQ.options[0];
  const cap = originOpt.globalCap ?? 100;

  const scores: Record<string, number> = {};
  let sum = 0;
  let weight = 0;

  for (const q of PART_QUESTIONS) {
    const answer = answers[q.key];
    if (!answer) continue;
    const opt = q.options.find((o) => o.id === answer);
    if (!opt) continue;
    const value = Math.min(opt.score, cap);
    scores[q.key] = value;
    sum += value * q.weight;
    weight += q.weight;
  }

  // Safety-critical points pull the overall score down: a bike can never be
  // reported as healthy while brakes or frame are faulty.
  let overall = weight ? Math.round(sum / weight) : 0;
  const critical = Math.min(scores.brakes ?? 100, scores.frame ?? 100);
  if (critical < 40) overall = Math.min(overall, critical + 15);
  overall = Math.max(0, Math.min(cap, overall));

  return {
    scores,
    overall,
    label: conditionLabel(overall),
    cap,
    isSecondHand: originOpt.id !== "new",
    origin: originOpt.id,
  };
}
/* ------------------------------------------------------------------ */
/*  Merged condition model                                             */
/* ------------------------------------------------------------------ */

export interface MergedMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  detail: string;
  chart: "ring" | "bars" | "wave";
  /** True when the value comes from a registered staff assessment. */
  assessed?: boolean;
}

export interface AssessmentLike {
  scores: Record<string, number> | null;
  overall_score: number;
  condition_label?: string;
  created_at?: string;
}

/**
 * Single source of truth for "Overall condition".
 *
 * Blends the deterministic telemetry health model with the latest registered
 * staff assessment: every inspected point overrides its telemetry value, the
 * remaining points keep the computed wear curve, and the final percentage is a
 * weighted average using the assessment weights. It stays honest — the bike can
 * never score above the last registered assessment, and a critical brake/frame
 * point pulls the total down.
 */
export function mergeAssessedHealth<T extends MergedMetric>(
  metrics: T[],
  assessment?: AssessmentLike | null,
): { metrics: T[]; overall: number; label: string; assessed: boolean } {
  const scores = assessment?.scores ?? null;

  const merged = metrics.map((m) => {
    const s = scores?.[m.key];
    return s == null
      ? m
      : ({ ...m, value: s, detail: `Assessed · ${m.detail}`, assessed: true } as T);
  });

  const weightOf = (key: string) =>
    PART_QUESTIONS.find((q) => q.key === key)?.weight ?? 0.1;

  let sum = 0;
  let weight = 0;
  for (const m of merged) {
    const w = weightOf(m.key);
    sum += m.value * w;
    weight += w;
  }
  let overall = weight
    ? Math.round(sum / weight)
    : Math.round(merged.reduce((s, m) => s + m.value, 0) / Math.max(1, merged.length));

  if (assessment) {
    // Honest cap: condition can only degrade after the last inspection.
    overall = Math.min(overall, assessment.overall_score);
  }

  const byKey = new Map(merged.map((m) => [m.key, m.value]));
  const critical = Math.min(byKey.get("brakes") ?? 100, byKey.get("frame") ?? 100);
  if (critical < 40) overall = Math.min(overall, critical + 15);
  overall = Math.max(0, Math.min(100, overall));

  return {
    metrics: merged,
    overall,
    label: conditionLabel(overall),
    assessed: !!assessment,
  };
}
