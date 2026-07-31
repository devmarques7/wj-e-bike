import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  pct: number;
  completedToday: number;
  totalToday: number;
  weeklyHours: number;
  targetHours: number;
}

/**
 * Arc gauge for today's workload (reference layout: big % inside a半 donut).
 */
export default function WorkloadGauge({
  pct,
  completedToday,
  totalToday,
  weeklyHours,
  targetHours,
}: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const R = 70;
  const C = Math.PI * R; // half circle length
  const stroke = C * (clamped / 100);
  const tone =
    clamped > 90 ? "text-destructive" : clamped > 70 ? "text-amber-500" : "text-wj-green";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="h-full rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md p-5 flex flex-col"
    >
      <h3 className="text-sm font-medium text-foreground mb-2">Today's workload</h3>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-[190px] max-w-full">
          <svg viewBox="0 0 180 100" className="w-full">
            <path
              d="M 20 92 A 70 70 0 0 1 160 92"
              fill="none"
              className="stroke-muted/40"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <motion.path
              d="M 20 92 A 70 70 0 0 1 160 92"
              fill="none"
              className={cn("stroke-current", tone)}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C - stroke }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            <span className={cn("text-3xl sm:text-4xl font-light tabular-nums", tone)}>
              {clamped}%
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Capacity used
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="p-3 rounded-2xl bg-muted/30">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tasks</p>
          <p className="text-sm text-foreground mt-0.5 tabular-nums">
            {completedToday}
            <span className="text-xs text-muted-foreground"> / {totalToday}</span>
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-muted/30">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hours</p>
          <p className="text-sm text-foreground mt-0.5 tabular-nums">
            {weeklyHours}
            <span className="text-xs text-muted-foreground"> / {targetHours || 40}h</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}