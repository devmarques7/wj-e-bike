import { useMemo } from "react";
import { motion } from "framer-motion";
import { Wrench, ShoppingBag, RotateCcw, Sparkles, HeartPulse, FileText, Folder, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityDay, ActivityRecord } from "@/hooks/wallet/useActivityYear";

interface Props {
  day: ActivityDay;
  onBack: () => void;
  backLabel?: string;
  onOpenRecord: (record: ActivityRecord) => void;
  healthScore?: number;
  bikeName?: string;
  /** All days with activity in the year, used for the inline month strip. */
  daysMap?: Map<string, ActivityDay>;
  onSelectDay?: (day: ActivityDay) => void;
}

const KIND_ICON = {
  service: Wrench,
  repair: Wrench,
  revision: RotateCcw,
  purchase: ShoppingBag,
} as const;

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Inline day view: replaces the calendar inside the same container. */
export default function ActivityDayPanel({
  day,
  onBack,
  backLabel = "Back to month",
  onOpenRecord,
  healthScore,
  bikeName,
  daysMap,
  onSelectDay,
}: Props) {
  const date = new Date(day.date);
  const briefing = day.records.find((r) => r.briefing)?.briefing;

  const [yy, mm] = day.date.split("-").map(Number);
  const cells = useMemo(() => {
    const total = new Date(yy, mm, 0).getDate();
    const lead = (new Date(yy, mm - 1, 1).getDay() + 6) % 7;
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, i) => iso(yy, mm - 1, i + 1)),
    ];
  }, [yy, mm]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-border/50 bg-card p-4 space-y-3"
    >
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition rounded-full border border-border/50 px-2.5 py-1"
      >
        <ChevronLeft className="h-3 w-3" />
        {backLabel}
      </button>

      {/* Big day header */}
      <div>
        <div className="flex items-end justify-between gap-4">
          <span className="text-5xl font-bold tracking-tighter text-foreground leading-none tabular-nums">
            {String(date.getDate()).padStart(2, "0")}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {date.toLocaleDateString("en-GB", { weekday: "short" })}
          </span>
        </div>
        <p className="text-sm font-semibold uppercase tracking-tight text-foreground mt-1">
          {date.toLocaleDateString("en-GB", { month: "long" })}{" "}
          <span className="text-muted-foreground/70">{date.getFullYear()}</span>
        </p>

        {/* Month dot strip (reference layout): current day highlighted */}
        <div className="mt-3">
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEK.map((w, i) => (
              <span key={i} className="text-[8px] uppercase tracking-widest text-muted-foreground/70">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={`lead-${i}`} />;
              const hit = daysMap?.get(d);
              const isCurrent = d === day.date;
              return (
                <button
                  key={d}
                  disabled={!hit || isCurrent}
                  onClick={() => hit && onSelectDay?.(hit)}
                  title={hit ? `${hit.records.length} activities` : undefined}
                  className={cn(
                    "aspect-square rounded-full transition-all",
                    isCurrent
                      ? "bg-wj-green ring-2 ring-wj-green/40 ring-offset-1 ring-offset-card"
                      : hit
                        ? "bg-foreground/80 hover:bg-wj-green cursor-pointer"
                        : "bg-muted/60",
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {day.records.map((r) => (
            <span
              key={r.id}
              title={r.title}
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                r.status === "completed" ? "bg-wj-green" : "bg-muted-foreground/40",
              )}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">
            {day.records.length} {day.records.length === 1 ? "activity" : "activities"} · +{day.points} points
          </span>
        </div>
      </div>

      <section className="rounded-xl border border-border/50 bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <FileText className="h-3.5 w-3.5 text-wj-green" />
          <h4 className="text-xs font-semibold text-foreground">Booking briefing</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          {briefing || "No briefing was registered for this day's booking."}
        </p>
      </section>

      <section className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5 text-wj-green" />
          <h4 className="text-xs font-semibold text-foreground">What was done</h4>
        </div>
        {day.records.map((r, i) => {
          const Icon = KIND_ICON[r.kind] ?? Wrench;
          return (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onOpenRecord(r)}
              className="w-full text-left rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition p-2.5 flex items-center gap-2.5"
            >
              <span className="h-7 w-7 rounded-lg bg-wj-green/10 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-wj-green" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground truncate">{r.title}</span>
                <span className="block text-[10px] text-muted-foreground capitalize">
                  {r.status.replace("_", " ")}
                  {r.extraCharge > 0 ? ` · parts & repairs €${r.extraCharge.toFixed(2)}` : ""}
                </span>
              </span>
              <span className="text-xs font-semibold text-wj-green">+{r.points}</span>
            </motion.button>
          );
        })}
      </section>

      <div className="flex items-center gap-2 rounded-xl bg-wj-green/10 px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-wj-green" />
        <span className="text-xs text-foreground font-medium">+{day.points} points earned</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          €{day.records.reduce((s, r) => s + r.extraCharge, 0).toFixed(2)} in parts & repairs
        </span>
      </div>

      {typeof healthScore === "number" && (
        <section className="rounded-xl border border-border/50 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-wj-green" />
            <h4 className="text-xs font-semibold text-foreground">Bike quality after this day</h4>
            <span className="ml-auto text-xs font-semibold text-wj-green">{healthScore}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${healthScore}%` }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-full bg-wj-green"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">{bikeName || "Your bike"} overall condition</p>
        </section>
      )}
    </motion.div>
  );
}