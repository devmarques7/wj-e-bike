/**
 * Overdue "rook": a global rule engine that keeps the workshop board honest.
 *
 * 1. Any task whose scheduled window has passed is treated as OVERDUE
 *    (handled by taskPriority.isTaskOverdue on read).
 * 2. Any task overdue for more than one full day is cancelled automatically and
 *    the customer is notified — nothing rots on the board.
 */
import { supabase } from "@/integrations/supabase/client";
import { isStaleOverdue, todayKey } from "@/lib/scheduling/taskPriority";

const ACTIVE = ["pending", "confirmed", "rescheduled"];

/** Yesterday (local) as YYYY-MM-DD — nothing newer can be 24h overdue. */
const cutoffDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export async function runOverdueSweep() {
  const now = new Date();
  let canceled = 0;
  let expired = 0;

  /* --- Appointments left behind for more than a day --- */
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, user_id, scheduled_date, scheduled_start_time, duration_minutes, status, service_type_id")
    .lte("scheduled_date", cutoffDate())
    .in("status", ACTIVE as any);

  for (const a of (appts ?? []) as any[]) {
    if (!isStaleOverdue(a, now)) continue;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "canceled" as any })
      .eq("id", a.id);
    if (error) continue;
    canceled += 1;
    await supabase.from("notifications").insert({
      user_id: a.user_id,
      type: "appointment_auto_canceled",
      title: "Appointment canceled",
      message: `Your appointment on ${a.scheduled_date} at ${String(a.scheduled_start_time).slice(0, 5)} was missed and has been canceled. You can book a new slot at any time.`,
      link: "/dashboard/service",
      metadata: { appointment_id: a.id, reason: "overdue_24h" },
    } as any);
  }

  /* --- Scheduling requests whose preferred window is long gone --- */
  const { data: reqs } = await supabase
    .from("appointment_waitlist")
    .select("id, user_id, preferred_date_from, preferred_time_from, status")
    .lt("preferred_date_from", cutoffDate())
    .eq("status", "pending");

  for (const r of (reqs ?? []) as any[]) {
    const { error } = await supabase
      .from("appointment_waitlist")
      .update({ status: "expired" })
      .eq("id", r.id);
    if (error) continue;
    expired += 1;
    await supabase.from("notifications").insert({
      user_id: r.user_id,
      type: "request_expired",
      title: "Service request expired",
      message: `Your service request for ${r.preferred_date_from} expired because the preferred window has passed.`,
      link: "/dashboard/service",
      metadata: { waitlist_id: r.id, reason: "overdue_24h" },
    } as any);
  }

  return { canceled, expired, date: todayKey() };
}