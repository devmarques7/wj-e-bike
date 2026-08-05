import { useEffect, useState } from "react";
import { useAppointmentsRealtimeTick } from "@/hooks/scheduling/useAppointmentsRealtime";
import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { localYmd as ymd } from "@/lib/scheduling/localDate";
const parseHM = (t: string | null) => {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export type StaffStats = {
  loading: boolean;
  tasksCompletedToday: number;
  tasksCompletedYesterday: number;
  appointmentsToday: number;
  appointmentsRemaining: number;
  avgServiceMinutes: number | null;
  avgServiceTargetMinutes: number;
  // Workload
  currentLoadPct: number;
  weeklyHours: number;
  targetHours: number;
  completedToday: number;
  totalToday: number;
};

const EMPTY: StaffStats = {
  loading: true,
  tasksCompletedToday: 0,
  tasksCompletedYesterday: 0,
  appointmentsToday: 0,
  appointmentsRemaining: 0,
  avgServiceMinutes: null,
  avgServiceTargetMinutes: 60,
  currentLoadPct: 0,
  weeklyHours: 0,
  targetHours: 0,
  completedToday: 0,
  totalToday: 0,
};

/**
 * Live stats for the Staff Overview page. All counters are scoped to the
 * logged-in mechanic via `assigned_mechanic_id` / `user_id` and refresh on
 * focus + every 60s.
 */
export function useStaffOverviewStats(
  userId: string | undefined,
  range?: { from: string; to: string },
) {
  const [stats, setStats] = useState<StaffStats>(EMPTY);
  // Any appointment change anywhere refreshes the mechanic's KPIs instantly.
  const tick = useAppointmentsRealtimeTick(!!userId);
  const rangeFrom = range?.from;
  const rangeTo = range?.to;

  useEffect(() => {
    if (!userId || !UUID_RE.test(userId)) {
      setStats({ ...EMPTY, loading: false });
      return;
    }

    let cancelled = false;

    const load = async () => {
      const today = new Date();
      const todayStr = ymd(today);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = ymd(yesterday);

      /* KPI scope = the selected dashboard period (defaults to today). */
      const scopeFrom = rangeFrom ?? todayStr;
      const scopeTo = rangeTo ?? todayStr;
      /* Comparison window of the same length, immediately before the scope. */
      const spanDays =
        Math.round(
          (new Date(`${scopeTo}T00:00:00`).getTime() -
            new Date(`${scopeFrom}T00:00:00`).getTime()) /
            86_400_000,
        ) + 1;
      const prevTo = new Date(`${scopeFrom}T00:00:00`);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevTo.getDate() - (spanDays - 1));

      // ISO week (Mon..Sun)
      const dow = (today.getDay() + 6) % 7; // 0 = Monday
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dow);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const [todayAppts, ydayAppts, weekAppts, recentDone, shifts, schedules] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id, status, duration_minutes, scheduled_date, scheduled_start_time")
            .eq("assigned_mechanic_id", userId)
            .gte("scheduled_date", scopeFrom)
            .lte("scheduled_date", scopeTo),
          supabase
            .from("appointments")
            .select("id, status")
            .eq("assigned_mechanic_id", userId)
            .gte("scheduled_date", ymd(prevFrom))
            .lte("scheduled_date", ymd(prevTo))
            .eq("status", "completed"),
          supabase
            .from("appointments")
            .select("id, duration_minutes, status")
            .eq("assigned_mechanic_id", userId)
            .gte("scheduled_date", ymd(weekStart))
            .lte("scheduled_date", ymd(weekEnd)),
          supabase
            .from("appointments")
            .select("actual_duration_minutes, duration_minutes")
            .eq("assigned_mechanic_id", userId)
            .eq("status", "completed")
            .not("actual_duration_minutes", "is", null)
            .gte("scheduled_date", scopeFrom)
            .lte("scheduled_date", scopeTo)
            .order("work_ended_at", { ascending: false })
            .limit(20),
          supabase
            .from("staff_shifts")
            .select("worked_minutes, break_minutes, clock_in, status")
            .eq("user_id", userId)
            .gte("shift_date", ymd(weekStart))
            .lte("shift_date", ymd(weekEnd)),
          supabase
            .from("staff_schedules")
            .select("day_of_week, is_working, start_time, end_time")
            .eq("staff_id", userId)
            .lte("valid_from", todayStr)
            .or(`valid_until.is.null,valid_until.gte.${todayStr}`),
        ]);

      if (cancelled) return;

      const todays = todayAppts.data ?? [];
      const totalToday = todays.length;
      const completedToday = todays.filter((a) => a.status === "completed").length;
      const remaining = todays.filter(
        (a) => a.status !== "completed" && a.status !== "canceled" && a.status !== "no_show",
      ).length;

      const tasksCompletedToday = completedToday;
      const tasksCompletedYesterday = (ydayAppts.data ?? []).length;

      const durations = (recentDone.data ?? [])
        .map((r: any) => r.actual_duration_minutes as number)
        .filter((n) => typeof n === "number" && n > 0);
      const avgServiceMinutes = durations.length
        ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
        : null;
      // Target = average planned duration_minutes across this week's appointments (fallback 60)
      const planned = (todays.length ? todays : (weekAppts.data ?? []))
        .map((a: any) => a.duration_minutes as number)
        .filter((n) => typeof n === "number" && n > 0);
      const avgServiceTargetMinutes = planned.length
        ? Math.round(planned.reduce((s, n) => s + n, 0) / planned.length)
        : 60;

      // Worked minutes this week (include active running segment)
      const now = Date.now();
      let workedMin = 0;
      for (const s of shifts.data ?? []) {
        if (s.status === "active" && s.clock_in) {
          // clock_in is the first entry of the day: gross time minus paused time.
          const gross = Math.floor((now - new Date(s.clock_in).getTime()) / 60000);
          workedMin += Math.max(0, gross - (s.break_minutes ?? 0));
        } else {
          workedMin += s.worked_minutes ?? 0;
        }
      }
      const weeklyHours = Math.round((workedMin / 60) * 10) / 10;

      // Target hours = sum scheduled day windows for working days
      const targetMinWeek = (schedules.data ?? [])
        .filter((s: any) => s.is_working)
        .reduce(
          (sum: number, s: any) =>
            sum + Math.max(0, parseHM(s.end_time) - parseHM(s.start_time)),
          0,
        );
      const targetHours = Math.round(targetMinWeek / 60);

      // Today's workload %: today's appointment minutes vs today's scheduled window
      const todayDow = today.getDay();
      const todaySch = (schedules.data ?? []).find(
        (s: any) => s.day_of_week === todayDow && s.is_working,
      );
      const todayWindowMin = todaySch
        ? Math.max(0, parseHM(todaySch.end_time) - parseHM(todaySch.start_time))
        : 0;
      const scopeDays = Math.max(1, spanDays);
      const todayBookedMin = todays
        .filter((a: any) => a.status !== "canceled" && a.status !== "no_show")
        .reduce((s: number, a: any) => s + (a.duration_minutes ?? 0), 0);
      const currentLoadPct =
        todayWindowMin > 0
          ? Math.min(
              100,
              Math.round((todayBookedMin / (todayWindowMin * scopeDays)) * 100),
            )
          : totalToday > 0
          ? Math.min(100, totalToday * 20)
          : 0;

      setStats({
        loading: false,
        tasksCompletedToday,
        tasksCompletedYesterday,
        appointmentsToday: totalToday,
        appointmentsRemaining: remaining,
        avgServiceMinutes,
        avgServiceTargetMinutes,
        currentLoadPct,
        weeklyHours,
        targetHours,
        completedToday,
        totalToday,
      });
    };

    load();
    const interval = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, tick, rangeFrom, rangeTo]);

  return stats;
}

export default useStaffOverviewStats;