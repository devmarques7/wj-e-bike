import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffKPICardProps {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: LucideIcon;
  index: number;
  /** Draws an animated running border to signal a pending action. */
  pending?: boolean;
}

export default function StaffKPICard({ label, value, change, trend, icon: Icon, index, pending }: StaffKPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "relative bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl p-4 lg:p-5",
        pending && "border-transparent"
      )}
    >
      {pending && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl p-[1px] [background:conic-gradient(from_var(--kpi-angle),transparent_0deg,hsl(var(--wj-green))_60deg,transparent_140deg)] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [-webkit-mask-composite:xor] animate-kpi-border"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl border border-wj-green/20"
          />
        </>
      )}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl lg:text-3xl font-light text-foreground">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-wj-green" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3 text-destructive" />
            ) : null}
            <span className={cn(
              "text-xs font-medium",
              trend === "up" && "text-wj-green",
              trend === "down" && "text-destructive",
              trend === "neutral" && "text-muted-foreground"
            )}>
              {change}
            </span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-wj-green/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-wj-green" />
        </div>
      </div>
    </motion.div>
  );
}
