import { HeartPulse, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { HealthMetric } from "@/hooks/garage/useGarageBike";

interface BikeHealthCardProps {
  bikeName: string;
  overall: number;
  metrics: HealthMetric[];
  daysToRevision: number | null;
  nextRevision: Date | null;
  onOpenGarage: () => void;
}

/** Compact bike condition summary reused from the Garage health model. */
export default function BikeHealthCard({
  bikeName,
  overall,
  metrics,
  daysToRevision,
  nextRevision,
  onOpenGarage,
}: BikeHealthCardProps) {
  const revisionLabel =
    daysToRevision === null
      ? "Not scheduled"
      : daysToRevision < 0
      ? `${Math.abs(daysToRevision)} days overdue`
      : daysToRevision === 0
      ? "Today"
      : `In ${daysToRevision} days`;

  const circumference = 2 * Math.PI * 34;

  return (
    <button
      type="button"
      onClick={onOpenGarage}
      className="rounded-3xl border border-border/50 bg-card p-5 lg:p-6 h-full w-full text-left flex flex-col hover:border-wj-green/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-wj-green/10 flex items-center justify-center shrink-0">
          <HeartPulse className="h-5 w-5 text-wj-green" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Bike health</p>
          <h3 className="text-sm font-semibold text-foreground truncate">{bikeName}</h3>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="34" className="stroke-border/50" strokeWidth="6" fill="none" />
            <motion.circle
              cx="40"
              cy="40"
              r="34"
              className="stroke-wj-green"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - overall / 100) }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-foreground">
            {overall}%
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {metrics.slice(0, 3).map((m) => (
            <div key={m.key}>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{m.label}</span>
                <span className="text-foreground/80">{m.value}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-border/50 overflow-hidden mt-1">
                <motion.div
                  className="h-full rounded-full bg-wj-green"
                  initial={{ width: 0 }}
                  animate={{ width: `${m.value}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-5 flex items-center gap-2 text-xs">
        <Clock className="h-4 w-4 text-wj-green shrink-0" />
        <span className="text-muted-foreground">Next revision</span>
        <span className="ml-auto font-medium text-foreground">
          {revisionLabel}
          {nextRevision && (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {nextRevision.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}