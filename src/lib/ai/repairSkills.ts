/**
 * Repair skills — the assistant's offline troubleshooting knowledge base.
 *
 * Every skill maps the most common real-world e-bike situations to a probable
 * cause, the steps the rider can try right now and when it must go to the
 * workshop. Matching runs 100% locally (0 AI tokens) against the diagnosis
 * answer tags, so the "my bike is not working properly" flow never needs the
 * model to produce a useful answer.
 */
import type { SymptomId } from "./diagnosis";
import type { DiagnosisSession } from "./diagnosisFlow";

export interface RepairSkill {
  id: string;
  /** Symptoms this skill can explain. */
  symptoms: SymptomId[];
  title: string;
  /** Probable cause, in rider language. */
  cause: string;
  /** Steps the rider can safely perform. */
  steps: string[];
  /** Keywords that must appear in the collected answers to boost the match. */
  cues?: string[];
  /** Never let the rider self-fix — book it. */
  workshopOnly?: boolean;
  /** Safety-critical: always shown first. */
  safety?: boolean;
  /** How often this fixes it, used to sort matches. */
  successRate: number;
}

export const REPAIR_SKILLS: RepairSkill[] = [
  /* ---------------- Power / electronics ---------------- */
  {
    id: "power_deep_discharge",
    symptoms: ["no_power", "battery"],
    title: "Battery in deep sleep (BMS protection)",
    cause:
      "After weeks unused the battery management system locks the pack to protect the cells, so the first press does nothing.",
    steps: [
      "Plug the original charger in and leave it for 30 minutes without touching the bike.",
      "Then hold the power button for 3 full seconds.",
      "If the charger LED stays off, try another wall socket before assuming a fault.",
    ],
    cues: ["no led", "haven't tried", "more than a week", "today"],
    successRate: 0.7,
  },
  {
    id: "power_battery_seating",
    symptoms: ["no_power", "display"],
    title: "Battery not seated / dirty contacts",
    cause: "A pack that isn't fully locked breaks the main circuit — the bike behaves as if it were dead.",
    steps: [
      "Unlock the battery, remove it and check the contacts for dirt, water or green oxidation.",
      "Dry everything and clean the contacts with a dry cloth (never with grease or water).",
      "Refit the pack until the lock clicks, then power on.",
    ],
    cues: ["rain", "wet", "no led", "battery area"],
    successRate: 0.55,
  },
  {
    id: "power_charger_dead",
    symptoms: ["battery", "no_power"],
    title: "Charger fault, not the battery",
    cause: "A charger with a broken cable or dead PSU is the single most common 'my battery died' case.",
    steps: [
      "Check the charger LED with the bike disconnected: no LED = the charger is the problem.",
      "Flex the cable near both ends — an intermittent LED confirms a broken wire.",
      "Never use a third-party charger: it can void the battery warranty.",
    ],
    cues: ["led blinks", "no led at all", "charging"],
    successRate: 0.45,
  },
  {
    id: "battery_cold_range",
    symptoms: ["battery"],
    title: "Cold weather / riding profile eats the range",
    cause: "Below 5 °C an e-bike pack can lose 20-30% of its usable range, and high assist plus headwind doubles the drain.",
    steps: [
      "Store and charge the battery indoors at room temperature.",
      "Ride a level lower in assist and keep the tyres at the pressure printed on the sidewall.",
      "Compare the range again on a mild day before we call it a fault.",
    ],
    cues: ["cold", "wet", "20-40", "40-60"],
    successRate: 0.4,
  },
  {
    id: "battery_capacity_loss",
    symptoms: ["battery"],
    title: "Real capacity loss — needs a bench test",
    cause: "Dying without warning or under 20 km on a full charge points to worn or unbalanced cells.",
    steps: [
      "Book a battery health test: we read the true capacity and the cell balance.",
      "Keep using the original charger until then and avoid draining the pack to 0%.",
    ],
    cues: ["less than 20", "dies without warning"],
    workshopOnly: true,
    successRate: 0.9,
  },

  /* ---------------- Motor / assist ---------------- */
  {
    id: "motor_speed_sensor",
    symptoms: ["motor", "display"],
    title: "Speed sensor magnet misaligned",
    cause: "The motor only assists when it sees wheel rotation. A magnet knocked out of line kills the assist completely.",
    steps: [
      "Find the small magnet on a rear spoke and the sensor on the chainstay.",
      "Align them so the magnet passes within 2-3 mm of the sensor mark.",
      "Spin the wheel — the speed should appear on the display.",
    ],
    cues: ["from the start", "randomly", "rear"],
    successRate: 0.6,
  },
  {
    id: "motor_thermal_cutoff",
    symptoms: ["motor"],
    title: "Thermal protection cutting the assist",
    cause: "Long climbs in the highest assist heat the motor, which then reduces or drops power until it cools.",
    steps: [
      "Note if it only fails uphill or after some minutes — that is the signature.",
      "Use a lower assist level and a lighter gear so the motor spins faster with less load.",
      "If it also cuts on flat ground when cold, it is not thermal — book a diagnostic.",
    ],
    cues: ["only uphill", "after some minutes", "only under load", "while accelerating"],
    successRate: 0.5,
  },
  {
    id: "motor_connector",
    symptoms: ["motor", "display"],
    title: "Intermittent motor connector",
    cause: "Vibration slowly backs the motor cable out of its plug, producing random cut-outs, often over bumps.",
    steps: [
      "Stop riding hard until it is checked — a cut-out under power is a safety risk.",
      "We reseat and secure the motor loom in a 20 minute diagnostic.",
    ],
    cues: ["intermittent", "over bumps", "randomly", "getting worse"],
    workshopOnly: true,
    successRate: 0.75,
  },

  /* ---------------- Brakes ---------------- */
  {
    id: "brake_contaminated_pads",
    symptoms: ["brakes", "noise"],
    title: "Contaminated or glazed brake pads",
    cause: "Oil, chain lube or road grime on the pads makes the brakes squeal loudly and lose bite.",
    steps: [
      "Do a few firm stops from 20 km/h in a safe place to bed the pads in.",
      "Never spray lube near the discs; clean the rotor with isopropyl alcohol only.",
      "If the squeal stays after bedding, the pads are contaminated and must be replaced.",
    ],
    cues: ["squeal", "noise", "while braking", "after a recent service"],
    successRate: 0.5,
  },
  {
    id: "brake_lever_to_bar",
    symptoms: ["brakes"],
    title: "Lever reaching the handlebar — safety stop",
    cause: "Air in the hydraulic line or pads worn to the backing plate. Braking distance is no longer reliable.",
    steps: [
      "Stop riding the bike now.",
      "We bleed the system and fit new pads — this is a same-day safety job.",
    ],
    cues: ["it feels unsafe", "no, it is unusable", "it blocks my rides"],
    workshopOnly: true,
    safety: true,
    successRate: 0.95,
  },
  {
    id: "brake_rubbing",
    symptoms: ["brakes", "noise"],
    title: "Rotor rubbing the caliper",
    cause: "A caliper a fraction of a millimetre off centre gives a rhythmic tick and a bike that feels slow.",
    steps: [
      "Loosen the two caliper bolts slightly, squeeze the brake hard and retighten while holding it.",
      "Spin the wheel: a light, even tick can settle after a few rides.",
      "A bent rotor needs to be trued in the workshop.",
    ],
    cues: ["constant", "while riding", "front", "rear"],
    successRate: 0.55,
  },

  /* ---------------- Drivetrain ---------------- */
  {
    id: "drivetrain_dirty_chain",
    symptoms: ["drivetrain", "noise"],
    title: "Dry or dirty chain",
    cause: "An unlubricated chain skips, rattles and shifts badly — and wears the cassette fast on an e-bike.",
    steps: [
      "Clean the chain with a degreaser and a brush, then dry it.",
      "Apply one drop of lube per link, spin the cranks and wipe off the excess.",
      "Re-test the shifting before booking anything.",
    ],
    cues: ["while pedalling", "all of them", "constant"],
    successRate: 0.6,
  },
  {
    id: "drivetrain_indexing",
    symptoms: ["drivetrain"],
    title: "Cable stretch / indexing out",
    cause: "New cables settle in the first weeks, so the gears drift out of alignment and skip in one direction.",
    steps: [
      "Turn the barrel adjuster on the shifter a quarter turn anticlockwise if it hesitates into easier gears.",
      "A quarter turn clockwise if it hesitates into harder gears.",
      "Test one gear at a time while pedalling lightly.",
    ],
    cues: ["only the easiest", "only the hardest", "one specific gear", "a recent service"],
    successRate: 0.55,
  },
  {
    id: "drivetrain_worn_chain",
    symptoms: ["drivetrain"],
    title: "Chain and cassette worn past the limit",
    cause: "E-bike torque wears chains 2-3x faster. Past 0.75% stretch the chain skips under power in every gear.",
    steps: [
      "We measure the chain with a wear gauge and replace the worn set.",
      "Avoid full-power starts in a hard gear to make the new set last.",
    ],
    cues: ["all of them", "while accelerating", "getting worse", "more than a week ago"],
    workshopOnly: true,
    successRate: 0.85,
  },
  {
    id: "drivetrain_bent_hanger",
    symptoms: ["drivetrain", "crash"],
    title: "Bent derailleur hanger",
    cause: "After a fall or a knock, the hanger bends a few degrees and no adjustment will hold the indexing.",
    steps: [
      "Do not force the largest sprocket — the derailleur can go into the spokes.",
      "We align the hanger with a gauge, or replace it if it is cracked.",
    ],
    cues: ["a crash or fall", "one specific gear"],
    workshopOnly: true,
    successRate: 0.9,
  },

  /* ---------------- Wheels / tyres ---------------- */
  {
    id: "wheel_pressure",
    symptoms: ["wheels", "noise"],
    title: "Under-inflated tyres",
    cause: "Most 'wobble', 'heavy' and 'slow' complaints are simply low pressure — e-bike tyres lose air every week.",
    steps: [
      "Inflate to the pressure printed on the tyre sidewall.",
      "Re-check after 24 hours: losing pressure overnight means a slow puncture.",
      "Inspect the tread for glass, staples or cuts.",
    ],
    cues: ["front", "rear", "both", "while riding"],
    successRate: 0.65,
  },
  {
    id: "wheel_bearing",
    symptoms: ["wheels", "noise"],
    title: "Hub bearing play or spoke tension",
    cause: "A rhythmic wobble that follows wheel speed (not pedalling) usually comes from bearing play or loose spokes.",
    steps: [
      "Lift the wheel and rock it sideways: any knock means bearing play.",
      "We re-tension and true the wheel, or replace the bearings.",
    ],
    cues: ["while coasting", "constant", "getting worse"],
    workshopOnly: true,
    successRate: 0.8,
  },

  /* ---------------- Display / connectivity ---------------- */
  {
    id: "display_error_code",
    symptoms: ["display", "motor", "no_power"],
    title: "Error code on the display",
    cause: "The controller stores a code that points straight at the faulty subsystem — it saves us diagnostic time.",
    steps: [
      "Write down the exact code (e.g. E-010) and send it with the booking.",
      "Power the bike off, remove the battery for 30 seconds and power it back on: transient codes clear.",
      "If the code returns immediately, book a diagnostic.",
    ],
    cues: ["yes", "error", "code"],
    successRate: 0.5,
  },
  {
    id: "display_pairing",
    symptoms: ["display"],
    title: "App / Bluetooth pairing lost",
    cause: "A phone OS update or a stale pairing key stops the app from seeing the bike.",
    steps: [
      "Forget the bike in your phone's Bluetooth settings, then re-pair from inside the app.",
      "Keep only one phone paired at a time.",
      "Update the app and the bike firmware before reporting a fault.",
    ],
    cues: ["app", "bluetooth", "pair", "firmware", "cockpit"],
    successRate: 0.6,
  },

  /* ---------------- Crash / structural ---------------- */
  {
    id: "crash_frame_inspection",
    symptoms: ["crash"],
    title: "Post-crash structural inspection",
    cause: "Impacts can crack a frame, fork or wheel invisibly. Riding a compromised frame is the highest risk case we see.",
    steps: [
      "Stop riding the bike immediately.",
      "Photograph every damaged area — the mechanic uses the photos before the bike arrives.",
      "We run a full structural and electronic inspection.",
    ],
    workshopOnly: true,
    safety: true,
    successRate: 1,
  },

  /* ---------------- Generic ---------------- */
  {
    id: "generic_service_due",
    symptoms: ["other", "noise", "drivetrain", "brakes", "wheels"],
    title: "General service overdue",
    cause: "Several small symptoms at once almost always mean the bike is simply due for its periodic revision.",
    steps: [
      "Book a standard revision: brakes, drivetrain, wheels, torque check and firmware in one visit.",
      "Bring any error codes or photos you have.",
    ],
    successRate: 0.35,
  },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export interface SkillMatch {
  skill: RepairSkill;
  score: number;
}

/** Rank the knowledge base against the collected diagnosis answers. */
export function matchRepairSkills(session: DiagnosisSession, limit = 2): SkillMatch[] {
  const symptomId = (session.symptomId ?? "other") as SymptomId;
  const haystack = norm(session.tags.map((t) => `${t.answer}`).join(" · "));

  const matches = REPAIR_SKILLS.filter((s) => s.symptoms.includes(symptomId)).map((skill) => {
    let score = skill.successRate;
    for (const cue of skill.cues ?? []) {
      if (haystack.includes(norm(cue))) score += 0.35;
    }
    if (skill.safety && /unsafe|unusable|blocks my rides|urgent/.test(haystack)) score += 1.5;
    if (skill.symptoms[0] === symptomId) score += 0.2;
    return { skill, score };
  });

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const SOLUTION_FIXED = "It's fixed, thanks";
export const SOLUTION_BOOK = "Still broken — book a revision";
export const SOLUTION_NO_DIY = "I'd rather the workshop do it";
export const SOLUTION_OPTIONS = [SOLUTION_FIXED, SOLUTION_BOOK, SOLUTION_NO_DIY];

/** Renders the matched skills as the assistant's solution message. */
export function buildSolutionMessage(session: DiagnosisSession): {
  content: string;
  options: string[];
  workshopOnly: boolean;
} {
  const matches = matchRepairSkills(session);
  if (!matches.length) {
    return {
      content:
        "I don't have a safe self-fix for this one. Let's get it in front of a mechanic.",
      options: [SOLUTION_BOOK],
      workshopOnly: true,
    };
  }

  const workshopOnly = matches[0].skill.workshopOnly === true;
  const blocks = matches.map(({ skill }, i) => {
    const head = i === 0 ? "**Most likely cause**" : "**Also possible**";
    const steps = skill.steps.map((s) => `${s}`).join("\n");
    return [
      `${head} · ${skill.title}${skill.safety ? " ⚠️" : ""}`,
      skill.cause,
      skill.workshopOnly ? "_Workshop job — please don't attempt this one yourself._" : "_Try this now:_",
      steps,
    ].join("\n");
  });

  const content = [
    "Here's my analysis before we book anything:",
    "",
    blocks.join("\n\n"),
    "",
    workshopOnly
      ? "This needs the workshop. Want me to find a slot?"
      : "Did any of that solve it?",
  ].join("\n");

  return {
    content,
    options: workshopOnly ? [SOLUTION_BOOK, SOLUTION_FIXED] : SOLUTION_OPTIONS,
    workshopOnly,
  };
}
