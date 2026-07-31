import { supabase } from "@/integrations/supabase/client";
import { todayKey } from "@/lib/scheduling/taskPriority";

/** A scheduling request waiting for a manager decision. */
export interface WaitlistRequest {
  id: string;
  user_id: string;
  service_type_id: string | null;
  subscription_id: string | null;
  bike_id: string | null;
  preferred_date_from: string;
  preferred_time_from: string | null;
  status: string;
  created_at: string;
  customer_name?: string | null;
  service_name?: string | null;
  duration_minutes?: number | null;
}

export interface Slot {
  date: string;
  start_time: string;
  end_time: string;
  mechanic_id: string;
  mechanic_name: string | null;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * First real opening for a service, scanning forward from `fromDate`.
 * Slots come from the same source the booking flows use, so capacity,
 * shifts and lead time are always respected.
 */
export async function findEarliestSlot(opts: {
  serviceTypeId: string;
  fromDate?: string;
  preferredTime?: string | null;
  mechanicId?: string | null;
  daysAhead?: number;
}): Promise<Slot | null> {
  const today = todayKey();
  let date =
    opts.fromDate && opts.fromDate > today ? opts.fromDate : today;
  const days = opts.daysAhead ?? 21;
  for (let i = 0; i < days; i++) {
    const { data, error } = await supabase.rpc("get_available_slots", {
      _date: date,
      _service_type_id: opts.serviceTypeId,
      _mechanic_id: opts.mechanicId ?? null,
    });
    if (error) throw error;
    const rows = (data ?? []) as any[];
    if (rows.length) {
      const pref = opts.preferredTime?.slice(0, 5);
      const match =
        (pref && rows.find((r) => r.start_time >= pref)) || rows[0];
      return {
        date,
        start_time: match.start_time,
        end_time: match.end_time,
        mechanic_id: match.mechanic_id,
        mechanic_name: match.mechanic_name ?? null,
      };
    }
    date = addDays(date, 1);
  }
  return null;
}

/** All openings for one day (used by the manual slot picker). */
export async function listSlots(
  serviceTypeId: string,
  date: string,
  mechanicId?: string | null,
): Promise<Slot[]> {
  const { data, error } = await supabase.rpc("get_available_slots", {
    _date: date,
    _service_type_id: serviceTypeId,
    _mechanic_id: mechanicId ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    date,
    start_time: r.start_time,
    end_time: r.end_time,
    mechanic_id: r.mechanic_id,
    mechanic_name: r.mechanic_name ?? null,
  }));
}

/**
 * Approve a request: turns the waitlist row into a confirmed appointment.
 * When no slot is given, the earliest available one is used (auto-assign).
 */
export async function approveRequest(
  req: WaitlistRequest,
  slot?: Slot | null,
): Promise<{ ok: boolean; slot?: Slot; error?: string }> {
  if (!req.service_type_id) return { ok: false, error: "Request has no service type" };
  let target = slot ?? null;
  if (!target) {
    target = await findEarliestSlot({
      serviceTypeId: req.service_type_id,
      fromDate: req.preferred_date_from,
      preferredTime: req.preferred_time_from,
    });
  }
  if (!target) return { ok: false, error: "No availability in the next 3 weeks" };

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      user_id: req.user_id,
      service_type_id: req.service_type_id,
      assigned_mechanic_id: target.mechanic_id,
      subscription_id: req.subscription_id,
      bike_id: req.bike_id,
      scheduled_date: target.date,
      scheduled_start_time: `${target.start_time}:00`,
      duration_minutes: req.duration_minutes ?? null,
      status: "confirmed" as any,
      booked_via: "admin_approval",
    } as any)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("appointment_waitlist")
    .update({ status: "booked", booked_appointment_id: data.id })
    .eq("id", req.id);

  return { ok: true, slot: target };
}

/** Reject a request (kept in history as expired). */
export async function rejectRequest(id: string) {
  const { error } = await supabase
    .from("appointment_waitlist")
    .update({ status: "expired" })
    .eq("id", id);
  if (error) throw error;
}

/** Auto-assign a batch of requests to the earliest openings, in order. */
export async function autoAssignRequests(reqs: WaitlistRequest[]) {
  let assigned = 0;
  const failures: string[] = [];
  for (const r of reqs) {
    try {
      const res = await approveRequest(r);
      if (res.ok) assigned += 1;
      else failures.push(res.error ?? "unknown");
    } catch (err: any) {
      failures.push(err?.message ?? "unknown");
    }
  }
  return { assigned, failures };
}
