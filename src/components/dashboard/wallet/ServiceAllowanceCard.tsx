import { CalendarCheck, CalendarClock, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { PlanAllowance } from "@/hooks/wallet/usePlanAllowance";

export interface UpgradeOption {
  slug: string;
  name: string;
  /** Care-efficiency of the plan relative to the best plan available (0-100). */
  percent: number;
  /** Marks the plan the rider is subscribed to today. */
  current?: boolean;
}

interface ServiceAllowanceCardProps {
  planName: string;
  allowance: PlanAllowance;
  /** Days remaining until the next revision of the registered E-Pass bike. */
  revisionDays?: number | null;
  revisionDate?: Date | string | null;
  bikeName?: string;
  upgradeOptions?: UpgradeOption[];
  onUpgrade?: () => void;
  onBook?: () => void;
}

/**
 * Wallet "plan + revision" panel.
 * Left rail: plan counters (bookings allowed / still available) and the upgrade
 * opportunities. Right rail: dotted countdown to the next bike revision.
 */
export default function ServiceAllowanceCard({
  planName,
  allowance,
  revisionDays,
  revisionDate,
  bikeName,
  upgradeOptions = [],
  onUpgrade,
  onBook,
}: ServiceAllowanceCardProps) {
  const { total, scheduled, remaining } = allowance;

  const days = typeof revisionDays === "number" ? Math.max(revisionDays, 0) : null;
  const ringProgress = days === null ? 0 : Math.max(0, Math.min(1, 1 - days / 90));

  const dateLabel = revisionDate
    ? new Date(revisionDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not scheduled";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.62fr)] gap-3 h-full">
      {/* ---------- Left rail ---------- */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="rounded-3xl border border-border/50 bg-card p-4 sm:p-5">
          <StatRow
            value={total}
            icon={<CalendarCheck className="h-5 w-5" />}
            label={`${planName} · services / 12 months`}
            action={<Plus className="h-4 w-4" />}
            onAction={onBook}
          />
          <div className="my-3 border-t border-dashed border-border/60" />
          <StatRow
            value={remaining}
            icon={<CalendarClock className="h-5 w-5" />}
            label={`${scheduled} scheduled · ${remaining} still bookable`}
            action={<ArrowUpRight className="h-4 w-4" />}
            onAction={onUpgrade}
          />
        </div>

        <div className="rounded-3xl border border-border/50 bg-card p-4 sm:p-5 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Care efficiency
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(upgradeOptions.length
              ? upgradeOptions
              : [{ slug: "max", name: "Top plan", percent: 100, current: true }]
            )
              .slice(0, 3)
              .map((opt) => (
                <button
                  key={opt.slug}
                  onClick={opt.current ? undefined : onUpgrade}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <DottedRing size={68} progress={opt.percent / 100} tone={opt.current ? "muted" : "green"}>
                    {opt.current ? (
                      <ShieldCheck className="h-4 w-4 text-foreground/70" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-foreground/70 group-hover:text-wj-green transition-colors" />
                    )}
                  </DottedRing>
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {opt.name}
                    {opt.current && " ·"}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${opt.current ? "text-muted-foreground" : "text-wj-green"}`}
                  >
                    {opt.percent}%
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* ---------- Right rail — revision countdown ---------- */}
      <div className="rounded-3xl bg-wj-green p-4 sm:p-5 flex flex-col items-center justify-between text-black min-h-[260px]">
        <div className="flex-1 flex items-center justify-center w-full">
          <DottedRing size={148} progress={ringProgress} tone="dark">
            <div className="text-center">
              <p className="text-3xl font-semibold leading-none">{days ?? "—"}</p>
              <p className="text-xs opacity-70 mt-1">Days</p>
            </div>
          </DottedRing>
        </div>
        <div className="w-full mt-4">
          <p className="text-sm font-semibold truncate">{bikeName || "Your bike"}</p>
          <p className="text-xs opacity-70 truncate">{dateLabel}</p>
          <button
            onClick={onBook}
            className="mt-3 w-full rounded-full bg-black text-white text-sm font-medium py-2.5 hover:opacity-90 transition-opacity"
          >
            Manage
          </button>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  value,
  icon,
  label,
  action,
  onAction,
}: {
  value: number;
  icon: React.ReactNode;
  label: string;
  action: React.ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <span className="text-3xl sm:text-4xl font-light text-foreground leading-none">{value}</span>
        <span className="text-muted-foreground shrink-0">{icon}</span>
      </div>
      <div className="hidden md:block min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
      <button
        onClick={onAction}
        className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-wj-green hover:bg-wj-green/10 transition-colors shrink-0"
      >
        {action}
      </button>
    </div>
  );
}

/** Circular ring built from dots, filled proportionally to `progress`. */
function DottedRing({
  size,
  progress,
  tone,
  children,
}: {
  size: number;
  progress: number;
  tone: "green" | "dark";
  children?: React.ReactNode;
}) {
  const dots = 32;
  const radius = size / 2 - 5;
  const active = Math.round(progress * dots);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        {Array.from({ length: dots }).map((_, i) => {
          const angle = (i / dots) * Math.PI * 2 - Math.PI / 2;
          const cx = size / 2 + radius * Math.cos(angle);
          const cy = size / 2 + radius * Math.sin(angle);
          const on = i < active;
          return (
            <motion.circle
              key={i}
              cx={cx}
              cy={cy}
              r={size > 100 ? 3.2 : 2.2}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.012 }}
              className={
                tone === "dark"
                  ? on
                    ? "fill-black"
                    : "fill-black/25"
                  : on
                  ? "fill-wj-green"
                  : "fill-border"
              }
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
