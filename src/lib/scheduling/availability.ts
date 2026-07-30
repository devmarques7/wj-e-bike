/**
 * Shared service-availability layer.
 *
 * Every surface that needs to know "when can this bike come in?" goes through
 * here so the rules stay identical: real business hours, real mechanic
 * schedules and no double booking. Mechanic identities are never exposed to
 * the customer — only the free time slots are.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AvailableSlot {
  start: string; // "09:00"
  end: string; // "10:00"
  /** Internal only — used to assign the appointment, never shown to riders. */
  mechanicId: string | null;
}

export interface DayAvailability {
  date: string; // yyyy-mm-dd
  label: string; // "Tue 4 Aug"
  slots: AvailableSlot[];
}

export interface ServiceTypeLite {
  id: string;
  name: string;
  slug: string;
  duration_minutes: number;
  base_price: number | null;
  is_emergency: boolean;
}

export const toDateKey = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

/**
 * Minimum notice (in minutes) between "now" on the rider's own device and the
 * start of a bookable slot. Prevents offering 10:00 when it's already 09:58.
 */
export const SLOT_LEAD_MINUTES = 30;

/** Local Date for a slot, built in the user's own timezone. */
export const slotDateTime = (dateKey: string, start: string) => {
  const [h, m] = start.split(":").map(Number);
  const d = new Date(`${dateKey}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

/** True when the slot is still far enough in the future to be booked. */
export const isSlotSelectable = (
  dateKey: string,
  start: string,
  leadMinutes: number = SLOT_LEAD_MINUTES,
) => slotDateTime(dateKey, start).getTime() >= Date.now() + leadMinutes * 60000;

export const dayLabel = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export async function fetchServiceTypes(): Promise<ServiceTypeLite[]> {
  const { data } = await supabase
    .from("service_types")
    .select("id, name, slug, duration_minutes, base_price, is_emergency")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  return (data ?? []) as ServiceTypeLite[];
}

/** Best-effort match of a diagnosis service hint to a real service type. */
export function resolveServiceType(
  types: ServiceTypeLite[],
  hint?: string | null,
): ServiceTypeLite | null {
  if (!types.length) return null;
  const h = (hint ?? "").toLowerCase().trim();
  if (h) {
    const match = types.find(
      (t) => t.slug.toLowerCase().includes(h) || t.name.toLowerCase().includes(h),
    );
    if (match) return match;
  }
  return types.find((t) => !t.is_emergency) ?? types[0];
}

/** Free slots for one day, de-duplicated so no mechanic identity leaks. */
export async function fetchDaySlots(
  dateKey: string,
  serviceTypeId: string,
): Promise<AvailableSlot[]> {
  const { data, error } = await supabase.rpc("get_available_slots", {
    _date: dateKey,
    _service_type_id: serviceTypeId,
    _mechanic_id: null,
  });
  if (error) return [];
  const byStart = new Map<string, AvailableSlot>();
  for (const row of (data ?? []) as any[]) {
    if (!isSlotSelectable(dateKey, String(row.start_time).slice(0, 5))) continue;
    if (!byStart.has(row.start_time)) {
      byStart.set(row.start_time, {
        start: row.start_time,
        end: row.end_time,
        mechanicId: row.mechanic_id ?? null,
      });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** Availability for the next `days` days (today included), days without slots kept out. */
export async function fetchAvailability(
  serviceTypeId: string,
  days = 7,
  from: Date = new Date(),
): Promise<DayAvailability[]> {
  const keys = Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return toDateKey(d);
  });
  const results = await Promise.all(
    keys.map(async (key) => ({
      date: key,
      label: dayLabel(key),
      slots: await fetchDaySlots(key, serviceTypeId),
    })),
  );
  return results.filter((d) => d.slots.length > 0);
}

export interface BookSlotInput {
  userId: string;
  serviceTypeId: string;
  date: string;
  slot: AvailableSlot;
  durationMinutes?: number;
  urgent?: boolean;
  notes?: string;
}

export async function bookSlot(input: BookSlotInput) {
  const subscriptionId = await fetchActiveSubscriptionId(input.userId);
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      user_id: input.userId,
      service_type_id: input.serviceTypeId,
      assigned_mechanic_id: input.slot.mechanicId,
      subscription_id: subscriptionId,
      scheduled_date: input.date,
      scheduled_start_time: `${input.slot.start}:00`,
      scheduled_end_time: `${input.slot.end}:00`,
      duration_minutes: input.durationMinutes ?? null,
      status: "pending",
      // DB CHECK: priority ∈ (normal | vip | emergency), booked_via ∈ (portal | admin | phone | walk_in)
      priority: input.urgent ? "emergency" : "normal",
      priority_score: input.urgent ? 100 : 50,
      booked_via: "portal",
      notes: input.notes ?? null,
    } as any)
    .select("id, scheduled_date, scheduled_start_time")
    .single();
  if (error) throw error;
  return data;
}

/** Active subscription of the rider — keeps Plan visible on admin/staff tables. */
export async function fetchActiveSubscriptionId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export type RequestPeriod = "morning" | "afternoon" | "any";

export interface AppointmentRequestInput {
  userId: string;
  serviceTypeId: string;
  period: RequestPeriod;
  /** yyyy-mm-dd, or null for "any day". */
  preferredDate?: string | null;
  urgent?: boolean;
  notes?: string;
}

const PERIOD_WINDOW: Record<RequestPeriod, [string | null, string | null]> = {
  morning: ["08:00:00", "12:00:00"],
  afternoon: ["12:00:00", "18:00:00"],
  any: [null, null],
};

/**
 * A scheduling REQUEST — not a confirmed appointment. An admin will try to fit
 * the rider into the best possible slot.
 */
export async function createAppointmentRequest(input: AppointmentRequestInput) {
  const [from, until] = PERIOD_WINDOW[input.period];
  const today = toDateKey(new Date());
  const dateFrom = input.preferredDate ?? today;
  const dateUntil = input.preferredDate ?? null;
  const subscriptionId = await fetchActiveSubscriptionId(input.userId);
  const { data, error } = await supabase
    .from("appointment_waitlist")
    .insert({
      user_id: input.userId,
      service_type_id: input.serviceTypeId,
      subscription_id: subscriptionId,
      preferred_date_from: dateFrom,
      preferred_date_until: dateUntil,
      preferred_time_from: from,
      preferred_time_until: until,
      status: "waiting",
      priority_score: input.urgent ? 100 : 50,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}