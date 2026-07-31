/**
 * Availability guard — the single client-side entry point for "can this day /
 * this slot really be booked?".
 *
 * The database enforces the same rules through the
 * `tg_validate_appointment_slot` trigger (closed workshop, mechanic off duty,
 * overlapping jobs, workshop capacity). This module mirrors those rules for the
 * UI and translates the trigger's error codes into human messages, so every
 * booking surface behaves identically.
 */
import { supabase } from "@/integrations/supabase/client";

export type DayAvailabilitySource = "schedule" | "exception" | "none";

export interface StaffDayAvailability {
  date: string;
  isWorking: boolean;
  startTime: string | null; // "09:00"
  endTime: string | null;
  maxConcurrent: number;
  source: DayAvailabilitySource;
}

export const dateKey = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

const hm = (t: string | null) => (t ? String(t).slice(0, 5) : null);

/** Real availability of a staff member on a date (weekly shift + exceptions). */
export async function fetchStaffDayAvailability(
  staffId: string,
  date: string,
): Promise<StaffDayAvailability> {
  const { data, error } = await (supabase.rpc as any)("staff_day_availability", {
    _staff_id: staffId,
    _date: date,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return { date, isWorking: false, startTime: null, endTime: null, maxConcurrent: 1, source: "none" };
  }
  return {
    date,
    isWorking: !!row.is_working,
    startTime: hm(row.start_time),
    endTime: hm(row.end_time),
    maxConcurrent: row.max_concurrent ?? 1,
    source: (row.source ?? "none") as DayAvailabilitySource,
  };
}

/** Opens (or closes) a staff member's availability for one specific date. */
export async function setStaffDayAvailability(args: {
  staffId: string;
  date: string;
  isWorking?: boolean;
  start?: string;
  end?: string;
  reason?: string | null;
}) {
  const { error } = await (supabase.rpc as any)("set_staff_day_availability", {
    _staff_id: args.staffId,
    _date: args.date,
    _is_working: args.isWorking ?? true,
    _start: `${args.start ?? "09:00"}:00`.slice(0, 8),
    _end: `${args.end ?? "18:00"}:00`.slice(0, 8),
    _reason: args.reason ?? null,
  });
  if (error) throw error;
}

/** Is the workshop itself open on this date? */
export async function isWorkshopOpen(date: string): Promise<boolean> {
  const dow = new Date(`${date}T12:00:00`).getDay();
  const [bh, ex] = await Promise.all([
    supabase
      .from("business_hours")
      .select("is_open, valid_from, valid_until")
      .eq("day_of_week", dow)
      .lte("valid_from", date)
      .or(`valid_until.is.null,valid_until.gte.${date}`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_hour_exceptions")
      .select("is_open")
      .eq("exception_date", date)
      .maybeSingle(),
  ]);
  if (ex.data) return !!ex.data.is_open;
  if (bh.data) return !!bh.data.is_open;
  return true;
}

/** Human message for the guard errors raised by the database trigger. */
export function describeSchedulingError(e: unknown): string {
  const msg = (e as any)?.message ?? String(e ?? "");
  if (msg.includes("WORKSHOP_CLOSED")) return "The workshop is closed on that date.";
  if (msg.includes("OUTSIDE_HOURS")) return "That time is outside the workshop opening hours.";
  if (msg.includes("MECHANIC_UNAVAILABLE"))
    return "The mechanic has no availability on that day — open the day first.";
  if (msg.includes("MECHANIC_OUTSIDE_SHIFT")) return "That time is outside the mechanic's shift.";
  if (msg.includes("SLOT_TAKEN")) return "That slot overlaps another job for the same mechanic.";
  if (msg.includes("WORKSHOP_FULL")) return "The workshop is already at full capacity at that time.";
  return msg || "Could not schedule the appointment.";
}
