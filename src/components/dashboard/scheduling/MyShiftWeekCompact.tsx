import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarOff,
  History,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ScheduleRow = {
  day_of_week: number;
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
};
type ShiftRow = {
  id: string;
  shift_date: string;
  worked_minutes: number;
  scheduled_minutes: number;
  clock_in: string | null;
  clock_out: string | null;
  notes: string | null;
  status: string;
};

const trim = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
import { localYmd as ymd } from "@/lib/scheduling/localDate";
function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}
const parseHM = (t: string | null) => {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

interface Props {
  userId: string;
  displayName: string;
}

/**
 * Personal weekly shift fulfillment compact view.
 * Shows % worked vs scheduled hours per day for the current user.
 * Mirrors the layout of TeamWeekWorkloadCompact.
 */
export default function MyShiftWeekCompact({ userId, displayName }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("pt") ? "pt-PT" : "en-GB";
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ShiftRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
    if (!userId) return;
    setLoading(true);
    try {
      const today = ymd(new Date());
      const [sR, shR] = await Promise.all([
        supabase
          .from("staff_schedules")
          .select("day_of_week, is_working, start_time, end_time")
          .eq("staff_id", userId)
          .lte("valid_from", today)
          .or(`valid_until.is.null,valid_until.gte.${today}`),
        supabase
          .from("staff_shifts")
          .select("id, shift_date, worked_minutes, scheduled_minutes, clock_in, clock_out, notes, status")
          .eq("user_id", userId)
          .gte("shift_date", fromISO)
          .lte("shift_date", toISO),
      ]);
      if (!sR.error) setSchedules((sR.data ?? []) as ScheduleRow[]);
      if (!shR.error) setShifts((shR.data ?? []) as ShiftRow[]);
    } finally {
      setLoading(false);
    }
  }, [userId, fromISO, toISO]);

  useEffect(() => {
    load();
  }, [load]);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff_shifts")
        .select("id, shift_date, worked_minutes, scheduled_minutes, clock_in, clock_out, notes, status")
        .eq("user_id", userId)
        .order("shift_date", { ascending: false })
        .limit(90);
      if (!error) setHistory((data ?? []) as ShiftRow[]);
    } finally {
      setHistoryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, loadHistory]);

  const getScheduled = (date: Date) => {
    const sch = schedules.find((s) => s.day_of_week === date.getDay());
    if (!sch || !sch.is_working) return 0;
    return Math.max(0, parseHM(sch.end_time) - parseHM(sch.start_time));
  };
  const getShift = (date: Date) =>
    shifts.find((s) => s.shift_date === ymd(date));

  const computeFill = (date: Date) => {
    const sched = getScheduled(date);
    const shift = getShift(date);
    const worked = shift?.worked_minutes ?? 0;
    const sm = shift?.scheduled_minutes && shift.scheduled_minutes > 0 ? shift.scheduled_minutes : sched;
    if (sm <= 0) return { off: true, pct: 0, worked, scheduled: 0 };
    return { off: false, pct: Math.min(100, Math.round((worked / sm) * 100)), worked, scheduled: sm };
  };

  const todayISO = ymd(new Date());
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const fmtHM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  };

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
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-2">
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
            size="sm"
            className="h-7 px-2 gap-1 text-[10px] text-muted-foreground hover:text-wj-green"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-3 w-3" />
            <span className="hidden sm:inline">History</span>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 7);
            setWeekStart(d);
          }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                  <div className="text-[11px] sm:text-xs font-medium text-foreground mt-0.5">
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row */}
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] sm:grid-cols-[minmax(70px,1fr)_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5 items-stretch flex-1 min-h-[52px] sm:min-h-[44px]">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 min-w-0 sm:pr-1 h-full">
                <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-wj-green/20 text-wj-green text-[10px] sm:text-[9px] font-bold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <span className="text-[11px] text-foreground truncate hidden sm:inline">
                  {displayName.split(" ")[0]}
                </span>
              </div>
              {days.map((d) => {
                const { off, pct, worked, scheduled } = computeFill(d);
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
                        ? "Off day"
                        : `${fmtHM(worked)} / ${fmtHM(scheduled)} · ${pct}%`
                    }
                  >
                    {off ? (
                      <CalendarOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                    ) : (
                      <>
                        <div
                          className={cn(
                            "absolute inset-x-0 bottom-0",
                            pct >= 100
                              ? "bg-wj-green/70"
                              : pct >= 80
                                ? "bg-wj-green/50"
                                : pct >= 50
                                  ? "bg-amber-500/40"
                                  : pct > 0
                                    ? "bg-destructive/40"
                                    : "bg-muted",
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
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-1 rounded-full bg-wj-green/60" />
          Worked vs scheduled
        </span>
        <span className="flex items-center gap-1">
          <CalendarOff className="h-2.5 w-2.5" />
          Off day
        </span>
      </div>

      {/* History modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl bg-background/95 backdrop-blur-xl border-border/40 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-wj-green" />
              My Shift History
            </DialogTitle>
            <DialogDescription>
              Last 90 days of logged shifts — worked hours vs scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-border/30">
            {historyLoading ? (
              <div className="py-12 flex items-center justify-center text-muted-foreground gap-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No shifts logged yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Date</TableHead>
                    <TableHead className="text-[11px]">Clock In</TableHead>
                    <TableHead className="text-[11px]">Clock Out</TableHead>
                    <TableHead className="text-[11px] text-right">Worked</TableHead>
                    <TableHead className="text-[11px] text-right">Scheduled</TableHead>
                    <TableHead className="text-[11px] text-right">Fill</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => {
                    const fill = row.scheduled_minutes > 0
                      ? Math.round((row.worked_minutes / row.scheduled_minutes) * 100)
                      : 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs font-medium">
                          {new Date(row.shift_date + "T00:00:00").toLocaleDateString(locale, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {row.clock_in ? new Date(row.clock_in).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {row.clock_out ? new Date(row.clock_out).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmtHM(row.worked_minutes)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{fmtHM(row.scheduled_minutes)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              fill >= 100
                                ? "border-wj-green/40 text-wj-green"
                                : fill >= 80
                                  ? "border-amber-500/40 text-amber-400"
                                  : "border-destructive/40 text-destructive",
                            )}
                          >
                            {fill}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">{row.status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}