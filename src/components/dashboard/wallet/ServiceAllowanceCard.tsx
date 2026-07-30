import { CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";
import type { PlanAllowance } from "@/hooks/wallet/usePlanAllowance";

interface ServiceAllowanceCardProps {
  planName: string;
  allowance: PlanAllowance;
}

/**
 * Validates the plan-covered appointments: how many the plan includes, how many
 * were already done, how many are booked and how many are still available.
 */
export default function ServiceAllowanceCard({ planName, allowance }: ServiceAllowanceCardProps) {
  const { total, used, scheduled, remaining } = allowance;
  const segments = Array.from({ length: Math.max(total, used + scheduled) }, (_, i) => {
    if (i < used) return "used" as const;
    if (i < used + scheduled) return "scheduled" as const;
    return "free" as const;
  });

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-5 lg:p-6 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-wj-green/10 flex items-center justify-center shrink-0">
          <CalendarCheck className="h-5 w-5 text-wj-green" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Plan services</p>
          <h3 className="text-sm font-semibold text-foreground truncate">
            {planName} · {total} / 12 months
          </h3>
        </div>
      </div>

      <div className="mt-5 flex gap-1.5">
        {segments.map((s, i) => (
          <motion.span
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className={[
              "h-2 flex-1 rounded-full origin-left",
              s === "used"
                ? "bg-wj-green"
                : s === "scheduled"
                ? "bg-wj-green/40"
                : "bg-border/60",
            ].join(" ")}
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 mt-auto pt-5">
        <Metric label="Completed" value={used} />
        <Metric label="Scheduled" value={scheduled} />
        <Metric label="Remaining" value={remaining} highlight />
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? "text-wj-green" : "text-foreground"}`}>{value}</p>
    </div>
  );
}