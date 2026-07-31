import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentsRealtimeTick } from "@/hooks/scheduling/useAppointmentsRealtime";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { localYmd as ymd } from "@/lib/scheduling/localDate";
const parseHM = (t: string | null) => {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export type WeekDayLoad = {
  date: string;
  dow: number;
  bookedMinutes: number;
  capacityMinutes: number;
  pct: number;
  jobs: number;
  isToday: boolean;
  isOff: boolean;
};

export type WeekAppt = {
  scheduled_date: string;
  duration_minutes: number | null;
  status: string;
};

export type WeekTotals = {
  /** Jobs assigned to me inside the current week (cancellations excluded). */
  jobs: number;
  bookedMinutes: number;
  capacityMinutes: number;
  /** Booked vs. available capacity, capped at 100%. */
  pct: number;
  completed: number;
  inProgress: number;
  upcoming: number;
  /** Minutes of work already completed or running. */
  workedMinutes: number;
  avgDurationMinutes: number;
  workingDays: number;
  /** True when there is no room left in the week. */
  isFull: boolean;
  level: "light" | "balanced" | "busy" | "full";
};

/**
 * Per-day booked-vs-capacity load for the mechanic's current week (Mon..Sun).
 * Capacity comes from staff_schedules, load from scheduled appointment minutes.
 */
export function useStaffWeekWorkload(userId: string | undefined) {
  const [days, setDays] = useState<WeekDayLoad[]>([]);
  const [appointments, setAppointments] = useState<WeekAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const tick = useAppointmentsRealtimeTick(!!userId);

  useEffect(() => {
    if (!userId || !UUID_RE.test(userId)) {
      setDays([]);
      setAppointments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const today = new Date();
      const todayStr = ymd(today);
      const offset = (today.getDay() + 6) % 7; // Monday-first
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - offset);
      const dates: Date[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      });

      const [apptRes, schRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("scheduled_date, duration_minutes, status")
          .eq("assigned_mechanic_id", userId)
          .gte("scheduled_date", ymd(dates[0]))
          .lte("scheduled_date", ymd(dates[6])),
        supabase
          .from("staff_schedules")
          .select("day_of_week, is_working, start_time, end_time")
          .eq("staff_id", userId)
          .lte("valid_from", todayStr)
          .or(`valid_until.is.null,valid_until.gte.${todayStr}`),
      ]);
      if (cancelled) return;

      const appts = (apptRes.data ?? []).filter(
        (a: any) => a.status !== "canceled" && a.status !== "no_show",
      );
      const schedules = schRes.data ?? [];
      setAppointments(appts as WeekAppt[]);

      setDays(
        dates.map((d) => {
          const iso = ymd(d);
          const dayAppts = appts.filter((a: any) => a.scheduled_date === iso);
          const booked = dayAppts.reduce(
            (s: number, a: any) => s + (a.duration_minutes ?? 60),
            0,
          );
          const sch: any = schedules.find(
            (s: any) => s.day_of_week === d.getDay() && s.is_working,
          );
          const capacity = sch
            ? Math.max(0, parseHM(sch.end_time) - parseHM(sch.start_time))
            : 0;
          return {
            date: iso,
            dow: d.getDay(),
            bookedMinutes: booked,
            capacityMinutes: capacity,
            pct: capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0,
            jobs: dayAppts.length,
            isToday: iso === todayStr,
            isOff: capacity === 0,
          };
        }),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  const totals: WeekTotals = (() => {
    const bookedMinutes = days.reduce((s, d) => s + d.bookedMinutes, 0);
    const capacityMinutes = days.reduce((s, d) => s + d.capacityMinutes, 0);
    const pct =
      capacityMinutes > 0 ? Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100)) : 0;
    const completed = appointments.filter((a) => a.status === "completed").length;
    const inProgress = appointments.filter((a) => a.status === "in_progress").length;
    const upcoming = appointments.filter(
      (a) => a.status === "pending" || a.status === "confirmed",
    ).length;
    const workedMinutes = appointments
      .filter((a) => a.status === "completed" || a.status === "in_progress")
      .reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
    const withDur = appointments.filter((a) => a.duration_minutes);
    return {
      jobs: appointments.length,
      bookedMinutes,
      capacityMinutes,
      pct,
      completed,
      inProgress,
      upcoming,
      workedMinutes,
      avgDurationMinutes: withDur.length
        ? Math.round(withDur.reduce((s, a) => s + (a.duration_minutes ?? 0), 0) / withDur.length)
        : 0,
      workingDays: days.filter((d) => !d.isOff).length,
      isFull: capacityMinutes > 0 && bookedMinutes >= capacityMinutes,
      level: pct >= 95 ? "full" : pct > 80 ? "busy" : pct > 50 ? "balanced" : "light",
    };
  })();

  return { days, appointments, totals, loading };
}

export default useStaffWeekWorkload;