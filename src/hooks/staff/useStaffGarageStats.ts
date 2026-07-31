import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GaragePeriod = "today" | "tomorrow" | "week" | "month";

export const GARAGE_PERIODS: { id: GaragePeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
];

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function rangeFor(period: GaragePeriod) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  if (period === "tomorrow") {
    start.setDate(today.getDate() + 1);
    end.setDate(today.getDate() + 1);
  } else if (period === "week") {
    end.setDate(today.getDate() + 6);
  } else if (period === "month") {
    end.setDate(today.getDate() + 29);
  }
  return { from: ymd(start), to: ymd(end) };
}

export interface GarageStats {
  loading: boolean;
  /** Bikes physically in the workshop right now (job in progress). */
  inGarage: number;
  /** Jobs scheduled/awaiting repair in the selected period. */
  forRepair: number;
  /** Urgent / high priority jobs — broken bikes. */
  broken: number;
  /** Completed repairs in the selected period. */
  fixed: number;
  /** Jobs scheduled for today (whole workshop). */
  today: number;
  /** Jobs scheduled for tomorrow. */
  tomorrow: number;
  /** Average real repair time (minutes) over the last completed jobs. */
  avgRepairMinutes: number | null;
  /** Average planned duration for the same jobs — the SLA target. */
  targetMinutes: number;
  /** % of completed jobs delivered within the planned duration. */
  onTimePct: number | null;
}

const EMPTY: GarageStats = {
  loading: true,
  inGarage: 0,
  forRepair: 0,
  broken: 0,
  fixed: 0,
  today: 0,
  tomorrow: 0,
  avgRepairMinutes: null,
  targetMinutes: 60,
  onTimePct: null,
};

/**
 * Workshop-wide garage counters for the staff Garage page.
 * Refreshes every 60s and on window focus.
 */
export function useStaffGarageStats(period: GaragePeriod, mineOnlyMechanicId?: string) {
  const [stats, setStats] = useState<GarageStats>(EMPTY);

  const load = useCallback(async () => {
    const { from, to } = rangeFor(period);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const mine = <T extends { or: (f: string) => T }>(q: T) =>
      mineOnlyMechanicId
        ? q.or(`assigned_mechanic_id.eq.${mineOnlyMechanicId},assigned_mechanic_id.is.null`)
        : q;

    const [rangeRes, todayRes, tomorrowRes, activeRes, doneRes] = await Promise.all([
      mine(supabase
        .from("appointments")
        .select("id, status, priority")
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)),
      mine(supabase.from("appointments").select("id").eq("scheduled_date", ymd(today))),
      mine(supabase.from("appointments").select("id").eq("scheduled_date", ymd(tomorrow))),
      mine(supabase.from("appointments").select("id").eq("status", "in_progress")),
      mine(supabase
        .from("appointments")
        .select("actual_duration_minutes, duration_minutes")
        .eq("status", "completed")
        .not("actual_duration_minutes", "is", null)
        .order("work_ended_at", { ascending: false })
        .limit(30)),
    ]);

    const rows = rangeRes.data ?? [];
    const done = doneRes.data ?? [];
    const durations = done
      .map((r) => r.actual_duration_minutes as number)
      .filter((n) => typeof n === "number" && n > 0);
    const planned = done
      .map((r) => r.duration_minutes as number)
      .filter((n) => typeof n === "number" && n > 0);
    const onTime = done.filter(
      (r) =>
        typeof r.actual_duration_minutes === "number" &&
        typeof r.duration_minutes === "number" &&
        (r.actual_duration_minutes as number) <= (r.duration_minutes as number),
    ).length;

    setStats({
      loading: false,
      inGarage: (activeRes.data ?? []).length,
      forRepair: rows.filter((r) => r.status === "pending" || r.status === "confirmed").length,
      broken: rows.filter((r) => r.priority === "urgent" || r.priority === "high").length,
      fixed: rows.filter((r) => r.status === "completed").length,
      today: (todayRes.data ?? []).length,
      tomorrow: (tomorrowRes.data ?? []).length,
      avgRepairMinutes: durations.length
        ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
        : null,
      targetMinutes: planned.length
        ? Math.round(planned.reduce((s, n) => s + n, 0) / planned.length)
        : 60,
      onTimePct: done.length ? Math.round((onTime / done.length) * 100) : null,
    });
  }, [period, mineOnlyMechanicId]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) load();
    };
    run();
    const interval = setInterval(run, 60_000);
    window.addEventListener("focus", run);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", run);
    };
  }, [load]);

  return { stats, refresh: load };
}

export default useStaffGarageStats;