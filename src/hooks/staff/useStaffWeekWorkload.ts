import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentsRealtimeTick } from "@/hooks/scheduling/useAppointmentsRealtime";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
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

/**
 * Per-day booked-vs-capacity load for the mechanic's current week (Mon..Sun).
 * Capacity comes from staff_schedules, load from scheduled appointment minutes.
 */
export function useStaffWeekWorkload(userId: string | undefined) {
  const [days, setDays] = useState<WeekDayLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const tick = useAppointmentsRealtimeTick(!!userId);

  useEffect(() => {
    if (!userId || !UUID_RE.test(userId)) {
      setDays([]);
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

  return { days, loading };
}

export default useStaffWeekWorkload;