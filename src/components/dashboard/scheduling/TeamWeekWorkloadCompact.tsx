import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, CalendarOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Mechanic } from "@/hooks/scheduling/useSchedulingData";
import { useAppointmentsRealtime } from "@/hooks/scheduling/useAppointmentsRealtime";

type ScheduleRow = {
  staff_id: string;
  day_of_week: number;
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
};
type ExceptionRow = {
  staff_id: string;
  exception_date: string;
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
};
type ApptRow = {
  assigned_mechanic_id: string | null;
  scheduled_date: string;
  duration_minutes: number | null;
};

const trim = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

interface Props {
  mechanics: Mechanic[];
}

/**
 * Read-only, minimalist weekly workload presentation for the team.
 * No configuration controls — purely data display, fully responsive.
 */
export default function TeamWeekWorkloadCompact({ mechanics }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("pt") ? "pt-PT" : "en-GB";
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [appts, setAppts] = useState<ApptRow[]>([]);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

  const fromISO = ymd(days[0]);
  const toISO = ymd(days[6]);

  const load = useCallback(async () => {
    if (!mechanics.length) return;
    setLoading(true);
    try {
      const ids = mechanics.map((m) => m.user_id);
      const today = ymd(new Date());
      const [sR, eR, aR] = await Promise.all([
        supabase
          .from("staff_schedules")
          .select("staff_id, day_of_week, is_working, start_time, end_time")
          .in("staff_id", ids)
          .lte("valid_from", today)
          .or(`valid_until.is.null,valid_until.gte.${today}`),
        supabase
          .from("staff_schedule_exceptions")
          .select("staff_id, exception_date, is_working, start_time, end_time")
          .in("staff_id", ids)
          .gte("exception_date", fromISO)
          .lte("exception_date", toISO),
        supabase
          .from("appointments")
          .select("assigned_mechanic_id, scheduled_date, duration_minutes")
          .in("assigned_mechanic_id", ids)
          .gte("scheduled_date", fromISO)
          .lte("scheduled_date", toISO)
          .in("status", ["pending", "confirmed", "in_progress", "completed"]),
      ]);
      if (!sR.error) setSchedules((sR.data ?? []) as ScheduleRow[]);
      if (!eR.error) setExceptions((eR.data ?? []) as ExceptionRow[]);
      if (!aR.error) setAppts((aR.data ?? []) as ApptRow[]);
    } finally {
      setLoading(false);
    }
  }, [mechanics, fromISO, toISO]);

  useEffect(() => {
    load();
  }, [load]);

  /* Stay in sync with every booking, reschedule or cancellation made anywhere
     in the app (customer portal, admin workshop, assistant). */
  useAppointmentsRealtime(load, mechanics.length > 0);

  const getEffective = (staffId: string, date: Date) => {
    const iso = ymd(date);
    const exc = exceptions.find((e) => e.staff_id === staffId && e.exception_date === iso);
    if (exc) {
      return { is_working: exc.is_working, start_time: trim(exc.start_time), end_time: trim(exc.end_time) };
    }
    const sch = schedules.find((s) => s.staff_id === staffId && s.day_of_week === date.getDay());
    if (sch) {
      return { is_working: sch.is_working, start_time: trim(sch.start_time), end_time: trim(sch.end_time) };
    }
    const dow = date.getDay();
    return { is_working: dow >= 1 && dow <= 5, start_time: "09:00", end_time: "18:00" };
  };

  const computeLoad = (staffId: string, date: Date) => {
    const eff = getEffective(staffId, date);
    if (!eff.is_working || !eff.start_time || !eff.end_time) return 0;
    const [sh, sm] = eff.start_time.split(":").map(Number);
    const [eh, em] = eff.end_time.split(":").map(Number);
    const totalMin = Math.max(60, eh * 60 + em - (sh * 60 + sm));
    const iso = ymd(date);
    const busyMin = appts
      .filter((a) => a.assigned_mechanic_id === staffId && a.scheduled_date === iso)
      .reduce((s, a) => s + (a.duration_minutes ?? 60), 0);
    return Math.min(100, Math.round((busyMin / totalMin) * 100));
  };

  const todayISO = ymd(new Date());

  return (
    <div className="w-full h-full flex flex-col">
      {/* Week nav */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() - 7);
            setWeekStart(d);
          }}
          aria-label={t("manage.team_week.prev")}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="text-[11px] font-medium text-foreground capitalize hover:text-wj-green transition-colors"
        >
          {days[0].toLocaleDateString(locale, { day: "numeric", month: "short" })} –{" "}
          {days[6].toLocaleDateString(locale, { day: "numeric", month: "short" })}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 7);
            setWeekStart(d);
          }}
          aria-label={t("manage.team_week.next")}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      ) : mechanics.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-8 text-xs text-muted-foreground">
          {t("manage.team.empty")}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Day header */}
          <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] sm:grid-cols-[minmax(70px,1fr)_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5 items-end">
            <div />
            {days.map((d) => {
              const isToday = ymd(d) === todayISO;
              const dw = d.getDay();
              const wknd = dw === 0 || dw === 6;
              return (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "text-center py-1 rounded-md text-[10px] uppercase tracking-wider",
                    isToday
                      ? "bg-wj-green/15 text-wj-green font-semibold"
                      : wknd
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground",
                  )}
                >
                  <div className="leading-none">
                    {d.toLocaleDateString(locale, { weekday: "narrow" })}
                  </div>
                  <div className="text-[11px] sm:text-xs font-medium text-foreground mt-0.5">{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Mechanic rows */}
          <div className="flex-1 flex flex-col gap-2 min-h-0">
          {mechanics.map((m) => {
            const initials = (m.full_name ?? m.email ?? "??")
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <div
                key={m.user_id}
                className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] sm:grid-cols-[minmax(70px,1fr)_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5 items-stretch flex-1 min-h-[52px] sm:min-h-[44px]"
              >
                <div className="flex items-center justify-center sm:justify-start gap-1.5 min-w-0 sm:pr-1 h-full">
                  <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-wj-green/20 text-wj-green text-[10px] sm:text-[9px] font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <span className="text-[11px] text-foreground truncate hidden sm:inline">
                    {(m.full_name ?? m.email ?? "").split(" ")[0]}
                  </span>
                </div>
                {days.map((d) => {
                  const eff = getEffective(m.user_id, d);
                  const pct = computeLoad(m.user_id, d);
                  const off = !eff.is_working;
                  const isToday = ymd(d) === todayISO;
                  return (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        "relative h-full min-h-[44px] sm:min-h-[36px] rounded-lg border flex items-center justify-center overflow-hidden",
                        off
                          ? "dark:bg-secondary/40 dark:border-secondary/30 bg-secondary/[0.15] border-secondary/20"
                          : "bg-muted/30 border-border/30",
                        isToday && "ring-1 ring-wj-green/40",
                      )}
                      title={
                        off
                          ? t("manage.team_week.legend_off")
                          : `${eff.start_time}–${eff.end_time} · ${pct}%`
                      }
                    >
                      {off ? (
                        <CalendarOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                      ) : (
                        <>
                          <div
                            className={cn(
                              "absolute inset-x-0 bottom-0",
                              pct >= 80
                                ? "bg-destructive/40"
                                : pct >= 50
                                  ? "bg-wj-green/50"
                                  : "bg-wj-green/25",
                            )}
                            style={{ height: `${Math.max(pct, 4)}%` }}
                          />
                          <span className="relative text-[11px] sm:text-[10px] font-semibold text-foreground tabular-nums">
                            {pct}%
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-1 rounded-full bg-wj-green/60" />
          {t("manage.team_week.legend_load")}
        </span>
        <span className="flex items-center gap-1">
          <CalendarOff className="h-2.5 w-2.5" />
          {t("manage.team_week.legend_off")}
        </span>
      </div>
    </div>
  );
}