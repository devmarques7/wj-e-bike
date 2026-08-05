import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isTaskOverdue } from "@/lib/scheduling/taskPriority";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** yyyy-mm-dd */
  date: string;
  /** Restrict to a single mechanic (assigned or finisher). */
  mechanicId?: string | null;
  locale?: string;
}

type Row = {
  id: string;
  status: string;
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  duration_minutes: number | null;
  work_started_at: string | null;
  work_ended_at: string | null;
  actual_duration_minutes: number | null;
  notes: string | null;
  reschedule_of: string | null;
  assigned_mechanic_id: string | null;
  completed_by: string | null;
  customer_name: string;
  service_name: string;
  mechanic_name: string | null;
  moved_to: { date: string; start: string } | null;
};

type Kind = "in_progress" | "completed" | "overdue" | "moved" | "canceled" | "scheduled";

const KIND_META: Record<Kind, { label: string; icon: typeof Clock; className: string; dot: string }> = {
  in_progress: { label: "In progress", icon: Loader2, className: "border-wj-green/40 bg-wj-green/10", dot: "bg-wj-green animate-pulse" },
  completed: { label: "Completed", icon: CheckCircle2, className: "border-wj-green/25 bg-muted/20", dot: "bg-wj-green/60" },
  overdue: { label: "Overdue", icon: AlertTriangle, className: "border-destructive/40 bg-destructive/10", dot: "bg-destructive" },
  moved: { label: "Rescheduled", icon: ArrowRightLeft, className: "border-amber-500/40 bg-amber-500/10", dot: "bg-amber-500" },
  canceled: { label: "Canceled", icon: XCircle, className: "border-border/40 bg-muted/20 opacity-70", dot: "bg-muted-foreground" },
  scheduled: { label: "Scheduled", icon: Clock, className: "border-border/40 bg-muted/30", dot: "bg-primary" },
};

const kindOf = (r: Row, now: Date): Kind => {
  if (r.status === "completed") return "completed";
  if (r.status === "in_progress") return "in_progress";
  if (r.status === "canceled" || r.status === "no_show") return "canceled";
  if (r.status === "rescheduled" || r.moved_to) return "moved";
  if (isTaskOverdue(r as any, now)) return "overdue";
  return "scheduled";
};

const ORDER: Record<Kind, number> = {
  in_progress: 0,
  overdue: 1,
  scheduled: 2,
  completed: 3,
  moved: 4,
  canceled: 5,
};

const fmtDuration = (mins?: number | null) =>
  mins && mins > 0 ? `${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ""}${mins % 60}m` : null;

/**
 * Full day log for a mechanic: everything that happened on a given date —
 * running jobs, finished ones, late ones, jobs moved to another day and
 * cancellations — so the calendar cell becomes an auditable timeline.
 */
export default function DayActivitiesDialog({ open, onOpenChange, date, mechanicId, locale = "en-GB" }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !date) return;
    let alive = true;
    (async () => {
      setLoading(true);
      let q = supabase.from("appointments").select("*").eq("scheduled_date", date);
      const { data } = await q.order("scheduled_start_time", { ascending: true });
      let appts = (data ?? []) as any[];
      if (mechanicId) {
        appts = appts.filter(
          (a) => a.assigned_mechanic_id === mechanicId || a.completed_by === mechanicId,
        );
      }

      const userIds = Array.from(new Set(appts.map((a) => a.user_id)));
      const mechIds = Array.from(
        new Set(appts.flatMap((a) => [a.assigned_mechanic_id, a.completed_by]).filter(Boolean)),
      ) as string[];
      const svcIds = Array.from(new Set(appts.map((a) => a.service_type_id).filter(Boolean))) as string[];
      const ids = appts.map((a) => a.id);

      const [profsRes, mechRes, svcRes, movedRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        mechIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", mechIds)
          : Promise.resolve({ data: [] as any[] }),
        svcIds.length
          ? supabase.from("service_types").select("id, name").in("id", svcIds)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase
              .from("appointments")
              .select("reschedule_of, scheduled_date, scheduled_start_time")
              .in("reschedule_of", ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.user_id, p]));
      const mechMap = new Map((mechRes.data ?? []).map((p: any) => [p.user_id, p]));
      const svcMap = new Map((svcRes.data ?? []).map((s: any) => [s.id, s]));
      const movedMap = new Map(
        (movedRes.data ?? []).map((m: any) => [
          m.reschedule_of,
          { date: m.scheduled_date, start: String(m.scheduled_start_time).slice(0, 5) },
        ]),
      );

      const mapped: Row[] = appts.map((a) => {
        const p = profMap.get(a.user_id);
        const m = mechMap.get(a.completed_by ?? a.assigned_mechanic_id ?? "");
        return {
          ...a,
          customer_name: p?.full_name ?? p?.email ?? "—",
          service_name: svcMap.get(a.service_type_id)?.name ?? "Service",
          mechanic_name: m?.full_name ?? null,
          moved_to: movedMap.get(a.id) ?? null,
        } as Row;
      });

      if (!alive) return;
      setRows(mapped);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [open, date, mechanicId]);

  const now = new Date();
  const decorated = rows
    .map((r) => ({ r, kind: kindOf(r, now) }))
    .sort(
      (a, b) =>
        ORDER[a.kind] - ORDER[b.kind] ||
        a.r.scheduled_start_time.localeCompare(b.r.scheduled_start_time),
    );

  const counts = decorated.reduce<Record<string, number>>((acc, { kind }) => {
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});

  const dayLabel = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border-border/40 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-light flex items-center gap-2 capitalize">
            <CalendarClock className="h-4 w-4 text-wj-green" /> {dayLabel}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Everything logged for this day — running, completed, late, moved and canceled jobs.
          </DialogDescription>
        </DialogHeader>

        {!loading && decorated.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(KIND_META) as Kind[])
              .filter((k) => counts[k])
              .map((k) => (
                <Badge key={k} variant="outline" className="text-[10px]">
                  {KIND_META[k].label} · {counts[k]}
                </Badge>
              ))}
          </div>
        )}

        <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && decorated.length === 0 && (
            <div className="py-10 text-center">
              <CalendarClock className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">No activity registered on this day.</p>
            </div>
          )}

          {!loading &&
            decorated.map(({ r, kind }) => {
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              const worked = fmtDuration(r.actual_duration_minutes ?? r.duration_minutes);
              return (
                <div
                  key={r.id}
                  className={cn("flex items-start gap-2.5 p-2.5 rounded-xl border", meta.className)}
                >
                  <div className={cn("w-1.5 h-full min-h-[34px] rounded-full shrink-0", meta.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {r.customer_name}
                      </p>
                      <Badge variant="outline" className="text-[9px] gap-1 shrink-0">
                        <Icon className={cn("h-2.5 w-2.5", kind === "in_progress" && "animate-spin")} />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{r.service_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                      <span>
                        {r.scheduled_start_time.slice(0, 5)}
                        {r.scheduled_end_time ? `–${r.scheduled_end_time.slice(0, 5)}` : ""}
                      </span>
                      {worked && <span>{worked}</span>}
                      {r.mechanic_name && <span>{r.mechanic_name}</span>}
                      {r.work_ended_at && (
                        <span>
                          Finished{" "}
                          {new Date(r.work_ended_at).toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {r.moved_to && (
                        <span className="text-amber-500">
                          Moved to {r.moved_to.date} · {r.moved_to.start}
                        </span>
                      )}
                      {r.reschedule_of && <span>Rescheduled from another slot</span>}
                    </div>
                    {r.notes && (
                      <p className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-2">
                        {r.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
