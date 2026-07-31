import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Clock, User, Wrench, ShieldCheck, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ensureShiftActive } from "@/hooks/useShift";
import { useStaffNextAppointment } from "@/hooks/staff/useStaffNextAppointment";
import AppointmentCompletionDrawer from "@/components/dashboard/scheduling/AppointmentCompletionDrawer";

interface Props {
  userId: string | undefined;
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "--:--");

/**
 * "What's next" card: surfaces the running job or the closest upcoming
 * appointment with a one-tap CTA that clocks the mechanic in, flips the
 * appointment to in_progress and opens the Quality Control drawer.
 */
export default function NextAppointmentCard({ userId }: Props) {
  const { appointment, loading, refetch } = useStaffNextAppointment(userId);
  const [busy, setBusy] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);

  const running = appointment?.status === "in_progress";

  const start = async () => {
    if (!appointment || busy) return;
    setBusy(true);
    try {
      if (!running) {
        await ensureShiftActive(userId);
        const { error } = await supabase
          .from("appointments")
          .update({
            status: "in_progress",
            assigned_mechanic_id: appointment.assigned_mechanic_id ?? userId,
          })
          .eq("id", appointment.id);
        if (error) throw error;
        await refetch();
      }
      setQcOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start this job");
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = appointment
    ? new Date(appointment.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative h-full overflow-hidden rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md p-5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-wj-green" />
          <h3 className="text-sm font-medium text-foreground">Next appointment</h3>
        </div>
        {running && (
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-wj-green">
            <span className="w-1.5 h-1.5 rounded-full bg-wj-green animate-pulse" />
            Running
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 min-h-[120px] animate-pulse rounded-2xl bg-muted/30" />
      ) : !appointment ? (
        <div className="flex-1 min-h-[120px] flex flex-col items-center justify-center text-center gap-2">
          <Wrench className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            No upcoming jobs. Your queue is clear.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-light text-foreground tabular-nums">
                {hhmm(appointment.scheduled_start_time)}
              </span>
              <span className="text-xs text-muted-foreground">{dateLabel}</span>
            </div>

            <div className="space-y-1.5">
              <p className="flex items-center gap-2 text-sm text-foreground truncate">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {appointment.customer_name ?? "Customer"}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                {appointment.service_name ?? "Service"}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {appointment.duration_minutes ?? 60} min
              </p>
            </div>
          </div>

          <Button
            onClick={start}
            disabled={busy}
            className="mt-4 w-full h-11 rounded-2xl gap-2 bg-wj-green text-white hover:bg-wj-green/90"
          >
            {running ? <ShieldCheck className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Continue control" : "Start Control"}
          </Button>
        </>
      )}

      <AppointmentCompletionDrawer
        appointment={qcOpen ? appointment : null}
        open={qcOpen}
        onOpenChange={setQcOpen}
        onCompleted={() => {
          setQcOpen(false);
          refetch();
        }}
      />
    </motion.div>
  );
}