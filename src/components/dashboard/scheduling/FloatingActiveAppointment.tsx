import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Wrench, ShieldCheck, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppointmentRow } from "@/hooks/scheduling/useSchedulingData";
import { useWorkPause } from "@/lib/workshop/workPause";

interface Props {
  appointment: AppointmentRow | null;
  onOpen: () => void;
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};

export default function FloatingActiveAppointment({ appointment, onOpen }: Props) {
  const { t } = useTranslation();
  const { isPaused, workNow } = useWorkPause();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!appointment?.work_started_at) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [appointment?.work_started_at]);

  const since = appointment?.work_started_at
    ? new Date(appointment.work_started_at).getTime()
    : null;
  const elapsed = since ? Math.max(0, Math.floor((workNow() - since) / 1000)) : 0;

  return (
    <AnimatePresence>
      {appointment && since && (
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <button
            onClick={onOpen}
            className="group relative overflow-hidden rounded-2xl border border-wj-green/40 bg-background/85 backdrop-blur-xl shadow-2xl shadow-black/30 pl-3 pr-2 py-2 flex items-center gap-3 hover:border-wj-green/70 transition-colors"
          >
            {/* pulsing icon */}
            <div className="relative w-9 h-9 rounded-xl bg-wj-green/15 flex items-center justify-center shrink-0">
              <Wrench className="h-4 w-4 text-wj-green" />
              <span
                className={
                  "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full " +
                  (isPaused ? "bg-amber-400" : "bg-wj-green animate-pulse")
                }
              />
            </div>

            <div className="text-left min-w-0 max-w-[200px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                {isPaused ? "Paused" : t("workshop.floating.running")}
              </p>
              <p className="text-xs font-medium text-foreground truncate mt-0.5">
                {appointment.customer_name ?? appointment.service_name ?? t("workshop.floating.appointment_fallback")}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {appointment.service_name ?? "—"}
              </p>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-wj-green/10 border border-wj-green/30 shrink-0">
              <Clock className="h-3 w-3 text-wj-green" />
              <span className="text-xs font-mono font-bold text-wj-green tabular-nums">
                {fmt(elapsed)}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-wj-green/15 flex items-center justify-center shrink-0 group-hover:bg-wj-green/25 transition-colors">
              <ShieldCheck className="h-4 w-4 text-wj-green" />
            </div>
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/60 mr-1" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}