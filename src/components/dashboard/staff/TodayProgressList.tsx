import { useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import QuickSlotPicker from "@/components/dashboard/scheduling/QuickSlotPicker";
import { isTaskOverdue } from "@/lib/scheduling/taskPriority";
import type { AppointmentRow } from "@/hooks/scheduling/useSchedulingData";

interface Props {
  appointments: AppointmentRow[];
  onChanged?: () => void;
}

type Kind = "ongoing" | "overdue" | "next" | "upcoming" | "done";

const kindOf = (a: AppointmentRow, now: Date): Kind => {
  if (a.status === "completed") return "done";
  if (a.status === "in_progress") return "ongoing";
  if (isTaskOverdue(a as any, now)) return "overdue";
  return "upcoming";
};

const ORDER: Record<Kind, number> = {
  ongoing: 0,
  next: 1,
  upcoming: 2,
  overdue: 3,
  done: 4,
};

/**
 * Today's progress with workshop triage: what is running now stays on top,
 * then the job due at the current hour (so the flow never falls behind),
 * then the rest, and only afterwards the late ones — each offering a direct
 * recovery slot — with completed jobs collapsed at the bottom.
 */
export default function TodayProgressList({ appointments, onChanged }: Props) {
  const now = new Date();
  const [target, setTarget] = useState<AppointmentRow | null>(null);
  const [slot, setSlot] = useState<{ date: string; start: string; mechanicId: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const decorated = appointments.map((a) => ({ a, kind: kindOf(a, now) }));
    // The open job whose window is the closest to right now is the priority.
    const openNow = decorated
      .filter((r) => r.kind === "upcoming")
      .sort((x, y) => x.a.scheduled_start_time.localeCompare(y.a.scheduled_start_time))[0];
    if (openNow) openNow.kind = "next";
    return decorated.sort(
      (x, y) =>
        ORDER[x.kind] - ORDER[y.kind] ||
        x.a.scheduled_start_time.localeCompare(y.a.scheduled_start_time),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments]);

  const reschedule = async () => {
    if (!target || !slot) return;
    setSaving(true);
    const dur = target.duration_minutes ?? 45;
    const [h, m] = slot.start.slice(0, 5).split(":").map(Number);
    const end = new Date(0);
    end.setHours(h, m + dur, 0, 0);
    const { error } = await supabase
      .from("appointments")
      .update({
        scheduled_date: slot.date,
        scheduled_start_time: `${slot.start.slice(0, 5)}:00`,
        scheduled_end_time: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`,
        assigned_mechanic_id: slot.mechanicId ?? target.assigned_mechanic_id,
        status: "confirmed",
      })
      .eq("id", target.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Rescheduled to ${slot.date} · ${slot.start.slice(0, 5)}`);
    setTarget(null);
    setSlot(null);
    onChanged?.();
  };

  if (!appointments.length) {
    return <p className="text-xs text-muted-foreground">No appointments scheduled for today.</p>;
  }

  return (
    <>
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[190px] pr-1">
        {rows.map(({ a, kind }) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border",
              kind === "overdue"
                ? "border-destructive/40 bg-destructive/10"
                : kind === "ongoing"
                  ? "border-wj-green/40 bg-wj-green/10"
                  : kind === "next"
                    ? "border-primary/50 bg-primary/5"
                    : kind === "done"
                      ? "border-transparent bg-muted/20 opacity-60"
                      : "border-transparent bg-muted/30",
            )}
          >
            <div
              className={cn(
                "w-1.5 h-6 rounded-full shrink-0",
                kind === "overdue"
                  ? "bg-destructive"
                  : kind === "ongoing"
                    ? "bg-wj-green animate-pulse"
                    : kind === "done"
                      ? "bg-wj-green/50"
                      : "bg-primary",
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate">
                {a.customer_name ?? a.customer_email ?? "—"}
              </p>
              <p
                className={cn(
                  "text-[10px] truncate",
                  kind === "overdue" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {kind === "overdue"
                  ? "Overdue — recover this slot"
                  : kind === "next"
                    ? `Next up · ${a.service_name ?? "—"}`
                    : (a.service_name ?? "—")}
              </p>
            </div>
            {kind === "overdue" && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setTarget(a);
                  setSlot(null);
                }}
              >
                <CalendarClock className="h-3 w-3 mr-1" /> Reschedule
              </Button>
            )}
            <Badge variant="outline" className="text-[10px] shrink-0">
              {a.scheduled_start_time.slice(0, 5)}
            </Badge>
          </div>
        ))}
      </div>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/40 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-light flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-wj-green" /> Recover late job
            </DialogTitle>
            <DialogDescription className="text-xs">
              {target?.customer_name ?? "This customer"} · {target?.service_name ?? "Service"} — pick
              the earliest free capacity so the flow keeps moving.
            </DialogDescription>
          </DialogHeader>
          <QuickSlotPicker
            serviceTypeId={target?.service_type_id}
            enabled={!!target}
            urgent
            selected={slot ? { date: slot.date, start: slot.start } : null}
            onSelect={setSlot}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!slot || saving} onClick={reschedule} className="rounded-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm new slot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
