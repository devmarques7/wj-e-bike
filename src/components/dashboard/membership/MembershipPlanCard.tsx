import { motion } from "framer-motion";
import { Check, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanWithActiveVersion } from "@/hooks/plans/usePlansData";

const intervalLabel: Record<string, string> = {
  monthly: "/mo",
  quarterly: "/quarter",
  yearly: "/year",
  lifetime: " once",
};

export default function MembershipPlanCard({
  plan,
  index,
  isCurrent,
  relation = "upgrade",
  onSelect,
}: {
  plan: PlanWithActiveVersion;
  index: number;
  isCurrent: boolean;
  relation?: "current" | "upgrade" | "downgrade";
  onSelect: (plan: PlanWithActiveVersion) => void;
}) {
  const v = plan.activeVersion;
  const accent = plan.color_hex ?? undefined;
  const current = isCurrent || relation === "current";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      className={cn(
        "relative flex flex-col rounded-3xl border p-6 bg-background/50 backdrop-blur-xl transition-colors",
        current
          ? "border-wj-green/70 bg-wj-green/10 ring-2 ring-wj-green/40 shadow-[0_0_40px_-12px_hsl(var(--primary))]"
          : "border-border/40 hover:border-wj-green/30",
      )}
    >
      {current && (
        <span className="absolute top-5 right-5 inline-flex items-center gap-1 px-2 h-6 rounded-full bg-wj-green/20 text-[10px] uppercase tracking-widest text-wj-green">
          <Check className="h-3 w-3" /> Current
        </span>
      )}

      <div
        className="h-10 w-10 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: accent ? `${accent}22` : undefined }}
      >
        <Crown className="h-5 w-5" style={{ color: accent ?? undefined }} />
      </div>

      <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
      {plan.description && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
      )}

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">
          {v ? `${v.currency === "EUR" ? "€" : ""}${Number(v.price).toFixed(2)}` : "—"}
        </span>
        <span className="text-sm text-muted-foreground">
          {v ? intervalLabel[v.interval] ?? "" : "no active version"}
        </span>
      </div>
      {v && v.trial_days > 0 && (
        <p className="text-xs text-wj-green mt-1">{v.trial_days} days free trial</p>
      )}

      <ul className="mt-6 space-y-2 flex-1">
        {(v?.features ?? []).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-wj-green shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
        {v?.urgent_service_included && (
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-wj-green shrink-0 mt-0.5" />
            <span>Urgent service included</span>
          </li>
        )}
      </ul>

      <Button
        className="mt-6 w-full rounded-full"
        variant={current ? "outline" : relation === "downgrade" ? "secondary" : "default"}
        disabled={current || !v}
        onClick={() => onSelect(plan)}
      >
        {current ? "Your membership" : relation === "downgrade" ? "Downgrade" : "Upgrade"}
      </Button>
    </motion.div>
  );
}