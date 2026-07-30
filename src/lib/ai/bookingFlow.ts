/**
 * In-chat booking flow (deterministic, 0 AI tokens).
 *
 * Runs right after a diagnosis: it shows the real free slots (never mechanic
 * names) and, when nothing fits, turns the conversation into a scheduling
 * REQUEST that an admin will try to fit in.
 */
import type { DayAvailability, RequestPeriod } from "@/lib/scheduling/availability";

export type BookingPhase =
  | "day"
  | "slot"
  | "request_period"
  | "request_day"
  | "request_urgency"
  | "done";

export interface BookingSession {
  phase: BookingPhase;
  serviceTypeId: string;
  serviceName: string;
  availability: DayAvailability[];
  date: string | null;
  urgent: boolean;
  notes: string;
  period: RequestPeriod | null;
  preferredDate: string | null;
}

export const NO_FIT_OPTION = "None of these work for me";
export const BACK_TO_DAYS = "Show other days";
export const ANY_DAY_OPTION = "Any day";

export const PERIOD_OPTIONS = ["Morning", "Afternoon", "Any time"];
export const URGENCY_OPTIONS = ["Yes, it's urgent", "No, normal priority"];

export function periodFromAnswer(answer: string): RequestPeriod {
  const a = answer.toLowerCase();
  if (a.includes("morn") || a.includes("manh")) return "morning";
  if (a.includes("after") || a.includes("tarde")) return "afternoon";
  return "any";
}

export function isUrgentAnswer(answer: string) {
  return /^y|urgen|sim/i.test(answer.trim());
}

export function dayOptions(session: BookingSession) {
  return [
    ...session.availability.map((d) => `${d.label} · ${d.slots.length} slots`),
    NO_FIT_OPTION,
  ];
}

export function matchDay(session: BookingSession, answer: string): DayAvailability | null {
  const a = answer.toLowerCase();
  return (
    session.availability.find((d) => a.includes(d.label.toLowerCase())) ??
    session.availability.find((d) => a.includes(d.date)) ??
    null
  );
}

export function slotOptions(session: BookingSession) {
  const day = session.availability.find((d) => d.date === session.date);
  return [...(day?.slots.map((s) => s.start) ?? []), BACK_TO_DAYS, NO_FIT_OPTION];
}

export function matchSlot(session: BookingSession, answer: string) {
  const day = session.availability.find((d) => d.date === session.date);
  if (!day) return null;
  const clean = answer.trim();
  return (
    day.slots.find((s) => s.start === clean) ??
    day.slots.find((s) => clean.includes(s.start)) ??
    null
  );
}

export function bookingPrompt(session: BookingSession): { content: string; options: string[] } | null {
  switch (session.phase) {
    case "day":
      return {
        content: `Thanks for filling everything in — the mechanic will get your briefing.\nThese are the days with free slots for **${session.serviceName}**. Which one works?`,
        options: dayOptions(session),
      };
    case "slot":
      return {
        content: "Great. Pick a time — all of these are confirmed free, no conflicts.",
        options: slotOptions(session),
      };
    case "request_period":
      return {
        content:
          "No problem — let's create a **scheduling request** instead (this is not a confirmed booking; our team will try to fit you in).\nWhich period suits you best?",
        options: PERIOD_OPTIONS,
      };
    case "request_day":
      return {
        content: "Any preferred day?",
        options: [ANY_DAY_OPTION],
      };
    case "request_urgency":
      return { content: "Is it urgent?", options: URGENCY_OPTIONS };
    default:
      return null;
  }
}