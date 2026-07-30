import { CalendarCheck, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { PlanAllowance } from "@/hooks/wallet/usePlanAllowance";

interface ServiceAllowanceCardProps {
  planName: string;
  allowance: PlanAllowance;
  planDescription?: string;
  features?: string[];
  onUpgrade?: () => void;
}

/**
 * Validates the plan-covered appointments: how many the plan includes, how many
 * were already done, how many are booked and how many are still available.
 */
export default function ServiceAllowanceCard({
  planName,
  allowance,
  planDescription,
  features,
  onUpgrade,
}: ServiceAllowanceCardProps) {
  const { total, used, scheduled, remaining } = allowance;
  const segments = Array.from({ length: Math.max(total, used + scheduled) }, (_, i) => {
    if (i < used) return "used" as const;
    if (i < used + scheduled) return "scheduled" as const;
    return "free" as const;
  });

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-5 lg:p-6 h-full flex flex-col">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-wj-green/10 flex items-center justify-center shrink-0">
          <CalendarCheck className="h-5 w-5 text-wj-green" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Plan services</p>
          <h3 className="text-sm font-semibold text-foreground truncate">
            {planName} · {total} / 12 months
          </h3>
          {planDescription && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{planDescription}</p>
          )}
        </div>
        {onUpgrade && (
          <Button
            size="sm"
            onClick={onUpgrade}
            className="rounded-full gradient-wj text-white hover:opacity-90 text-xs font-semibold px-4 py-1 h-7 shrink-0"
          >
            Upgrade
          </Button>
        )}
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

      {features && features.length > 0 && (
        <ul className="mt-5 space-y-2 max-h-40 overflow-y-auto pr-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
              <Check className="h-4 w-4 text-wj-green shrink-0 mt-0.5" />
              <span className="leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      )}
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