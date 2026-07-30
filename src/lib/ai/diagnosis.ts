/**
 * Guided bike diagnosis.
 *
 * The assistant's #1 job is to turn "something is wrong with my bike" into a
 * booked revision with a complete repair briefing for the staff. This module
 * holds the deterministic (zero-token) questionnaire, the quick self-help
 * hints per symptom and the briefing builder consumed by the booking flow.
 */

export type SymptomId =
  | "no_power"
  | "battery"
  | "motor"
  | "brakes"
  | "drivetrain"
  | "wheels"
  | "noise"
  | "display"
  | "crash"
  | "other";

export interface DiagnosisQuestion {
  id: string;
  question: string;
  options: string[];
  allowFreeText?: boolean;
}

export interface SymptomDefinition {
  id: SymptomId;
  label: string;
  description: string;
  /** Immediate self-help steps shown before booking. */
  quickChecks: string[];
  /** Service type keyword used to pre-select the booking service. */
  serviceHint: string;
  urgent?: boolean;
  questions: DiagnosisQuestion[];
}

const COMMON_QUESTIONS: DiagnosisQuestion[] = [
  {
    id: "since",
    question: "When did it start?",
    options: ["Today", "This week", "More than a week ago", "It comes and goes"],
  },
  {
    id: "rideable",
    question: "Can you still ride the bike safely?",
    options: ["Yes, normally", "Yes, but limited", "No, it is unusable"],
  },
];

/** Quick path — three questions only, then straight to the slots. */
export const QUICK_QUESTIONS: DiagnosisQuestion[] = [
  {
    id: "quick_urgent",
    question: "Is it urgent?",
    options: ["Yes, I can't ride", "Yes, but I can manage", "No, it can wait"],
  },
];

/** Full path — everything a mechanic needs before touching the bike. */
export const FULL_EXTRA_QUESTIONS: DiagnosisQuestion[] = [
  {
    id: "where_exact",
    question: "Where exactly on the bike is it?",
    options: ["Front", "Rear", "Drivetrain / middle", "Cockpit", "Battery area", "Not sure"],
    allowFreeText: true,
  },
  {
    id: "behaviour",
    question: "How does it behave?",
    options: ["Constant", "Intermittent", "Only under load", "Only when cold or wet", "Getting worse"],
  },
  {
    id: "conditions",
    question: "When does it happen most?",
    options: ["While riding", "While braking", "While accelerating", "Standing still", "While charging"],
  },
  {
    id: "impact",
    question: "How bad is it right now?",
    options: ["Minor", "Annoying", "It blocks my rides", "It feels unsafe"],
  },
  {
    id: "history",
    question: "Did anything happen before it started?",
    options: ["A crash or fall", "A new part was fitted", "A recent service", "Nothing special"],
    allowFreeText: true,
  },
  {
    id: "urgency",
    question: "How soon do you need it fixed?",
    options: ["As soon as possible", "This week", "Anytime in the next weeks"],
  },
];

export const SYMPTOMS: SymptomDefinition[] = [
  {
    id: "no_power",
    label: "Bike won't turn on",
    description: "No lights, no display, no assistance.",
    serviceHint: "electric",
    urgent: true,
    quickChecks: [
      "Hold the power button for 3 seconds with the battery fully seated.",
      "Charge for 20 minutes — a deeply discharged battery ignores the first press.",
      "Check the battery lock and the main connector for dirt or moisture.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "charger",
        question: "What happens when you plug in the charger?",
        options: ["No LED at all", "LED blinks", "LED is green immediately", "I haven't tried"],
      },
    ],
  },
  {
    id: "battery",
    label: "Battery / range issue",
    description: "Drains fast, won't charge or dies mid-ride.",
    serviceHint: "battery",
    quickChecks: [
      "Compare the range with a full charge and mostly flat terrain.",
      "Avoid charging below 0 °C — cold cells lose capacity temporarily.",
      "Use only the original WJ charger.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "range",
        question: "How much range are you getting?",
        options: ["Less than 20 km", "20-40 km", "40-60 km", "It dies without warning"],
      },
    ],
  },
  {
    id: "motor",
    label: "Motor / assistance",
    description: "No assist, cuts out or feels weaker.",
    serviceHint: "motor",
    quickChecks: [
      "Switch assistance levels — a stuck level reads as \"no assist\".",
      "Spin the rear wheel: the speed sensor magnet must pass close to the sensor.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "when",
        question: "When does it fail?",
        options: ["From the start", "Only uphill", "After some minutes", "Randomly"],
      },
    ],
  },
  {
    id: "brakes",
    label: "Brakes",
    description: "Weak, noisy or rubbing brakes.",
    serviceHint: "brake",
    urgent: true,
    quickChecks: [
      "Do not ride if the lever reaches the handlebar — that is a safety stop.",
      "Squealing after rain usually clears after a few careful stops.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "which",
        question: "Which brake?",
        options: ["Front", "Rear", "Both"],
      },
    ],
  },
  {
    id: "drivetrain",
    label: "Chain / gears",
    description: "Skipping, slipping or noisy shifting.",
    serviceHint: "drivetrain",
    quickChecks: [
      "Clean and lubricate the chain before judging the shifting.",
      "Check for a bent hanger if the chain skips only in one gear.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "gears",
        question: "Which gears are affected?",
        options: ["All of them", "Only the easiest", "Only the hardest", "One specific gear"],
      },
    ],
  },
  {
    id: "wheels",
    label: "Wheels / tyres",
    description: "Flat tyre, wobble or vibration.",
    serviceHint: "tyre",
    quickChecks: [
      "Check pressure first — most \"wobbles\" are under-inflated tyres.",
      "Inspect the tread for glass, staples or cuts.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "where",
        question: "Which wheel?",
        options: ["Front", "Rear", "Both"],
      },
    ],
  },
  {
    id: "noise",
    label: "Strange noise",
    description: "Clicking, grinding or rattling.",
    serviceHint: "maintenance",
    quickChecks: [
      "Note if the noise follows pedalling (drivetrain) or wheel speed (bearings).",
      "Re-torque the bottle cage, rack and mudguard bolts.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "trigger",
        question: "When do you hear it?",
        options: ["While pedalling", "While coasting", "While braking", "Over bumps"],
      },
    ],
  },
  {
    id: "display",
    label: "Display / app / connectivity",
    description: "Error codes, pairing or firmware issues.",
    serviceHint: "diagnostic",
    quickChecks: [
      "Note the exact error code shown on the display.",
      "Restart the bike and re-pair it in the app.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "code",
        question: "Is there an error code?",
        options: ["Yes", "No", "The display is blank"],
        allowFreeText: true,
      },
    ],
  },
  {
    id: "crash",
    label: "Crash / damage",
    description: "The bike was dropped, hit or stolen-attempt damaged.",
    serviceHint: "inspection",
    urgent: true,
    quickChecks: [
      "Stop riding until the frame and fork are inspected.",
      "Photograph every damaged area for the briefing.",
    ],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "parts",
        question: "What looks damaged?",
        options: ["Frame", "Fork / wheel", "Cockpit", "Cosmetic only"],
        allowFreeText: true,
      },
    ],
  },
  {
    id: "other",
    label: "Something else",
    description: "Describe it in your own words.",
    serviceHint: "maintenance",
    quickChecks: ["Describe what changed and when, so the mechanic can reproduce it."],
    questions: [
      ...COMMON_QUESTIONS,
      {
        id: "detail",
        question: "What is happening?",
        options: [],
        allowFreeText: true,
      },
    ],
  },
];

export function getSymptom(id: SymptomId): SymptomDefinition {
  return SYMPTOMS.find((s) => s.id === id) ?? SYMPTOMS[SYMPTOMS.length - 1];
}

/** Map a free-text prompt to the most likely symptom (zero tokens). */
export function matchSymptom(text: string): SymptomDefinition | null {
  const t = text.toLowerCase();
  const table: Array<[SymptomId, string[]]> = [
    ["no_power", ["não liga", "nao liga", "won't turn on", "wont turn on", "doesn't turn on", "no power", "dead", "sem energia", "não funciona", "nao funciona"]],
    ["battery", ["battery", "bateria", "charge", "carregar", "range", "autonomia"]],
    ["motor", ["motor", "assist", "assistência", "assistencia", "power cut", "sem força", "sem forca"]],
    ["brakes", ["brake", "freio", "travão", "travao", "squeal"]],
    ["drivetrain", ["chain", "corrente", "gear", "marcha", "câmbio", "cambio", "shift"]],
    ["wheels", ["tyre", "tire", "pneu", "wheel", "roda", "flat", "furou", "wobble"]],
    ["noise", ["noise", "barulho", "ruído", "ruido", "creak", "grinding"]],
    ["display", ["display", "error", "erro", "app", "firmware", "bluetooth", "pair"]],
    ["crash", ["crash", "queda", "caí", "cai ", "accident", "acidente", "damage", "dano", "batida"]],
  ];
  for (const [id, words] of table) {
    if (words.some((w) => t.includes(w))) return getSymptom(id);
  }
  return null;
}

export interface RepairBriefing {
  symptomId: SymptomId;
  symptomLabel: string;
  serviceHint: string;
  urgent: boolean;
  answers: Array<{ question: string; answer: string }>;
  notes: string;
  createdAt: string;
  /** Ready-to-read text block for the staff. */
  summary: string;
}

export const REPAIR_BRIEFING_STORAGE_KEY = "wj.repair.briefing.v1";

export function buildBriefing(
  symptom: SymptomDefinition,
  answers: Array<{ question: string; answer: string }>,
  notes: string,
): RepairBriefing {
  const summary = [
    `REPAIR BRIEFING — ${symptom.label}`,
    symptom.urgent ? "Priority: HIGH (safety related)" : "Priority: standard",
    "",
    ...answers.map((a) => `${a.question} ${a.answer}`),
    notes ? `\nCustomer notes: ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    symptomId: symptom.id,
    symptomLabel: symptom.label,
    serviceHint: symptom.serviceHint,
    urgent: Boolean(symptom.urgent),
    answers,
    notes,
    createdAt: new Date().toISOString(),
    summary,
  };
}

export function saveBriefing(briefing: RepairBriefing) {
  try {
    window.localStorage.setItem(REPAIR_BRIEFING_STORAGE_KEY, JSON.stringify(briefing));
  } catch {
    /* ignore */
  }
}

export function loadBriefing(): RepairBriefing | null {
  try {
    const raw = window.localStorage.getItem(REPAIR_BRIEFING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RepairBriefing) : null;
  } catch {
    return null;
  }
}