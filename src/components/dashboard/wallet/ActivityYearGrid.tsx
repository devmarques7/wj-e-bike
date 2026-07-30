import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityDay } from "@/hooks/wallet/useActivityYear";

interface Props {
  year: number;
  daysMap: Map<string, ActivityDay>;
  onYearChange: (year: number) => void;
  onSelectDay: (day: ActivityDay) => void;
  selectedDate?: string | null;
  loading?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Year activity map: each dot is one calendar day, filled when the rider had activity
 * (services, repairs or purchases). Clicking a dot surfaces the points earned that day.
 */
export default function ActivityYearGrid({
  year,
  daysMap,
  onYearChange,
  onSelectDay,
  selectedDate,
  loading,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const months = useMemo(
    () =>
      MONTHS.map((label, m) => {
        const total = new Date(year, m + 1, 0).getDate();
        return {
          label,
          days: Array.from({ length: total }, (_, i) => iso(year, m, i + 1)),
        };
      }),
    [year],
  );

  const activeDays = daysMap.size;
  const totalPoints = useMemo(
    () => Array.from(daysMap.values()).reduce((s, d) => s + d.points, 0),
    [daysMap],
  );
  const busiest = useMemo(() => {
    let best: ActivityDay | null = null;
    daysMap.forEach((d) => {
      if (!best || d.records.length > best.records.length) best = d;
    });
    return best as ActivityDay | null;
  }, [daysMap]);

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold tracking-tight text-foreground tabular-nums">{year}</span>
            <span className="text-sm text-muted-foreground uppercase tracking-widest">Activity map</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {activeDays} active {activeDays === 1 ? "day" : "days"} · {totalPoints} points earned
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onYearChange(year - 1)}
            className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onYearChange(year + 1)}
            disabled={year >= new Date().getFullYear()}
            className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
        {months.map((month) => (
          <div key={month.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {month.label}
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {month.days.map((date) => {
                const day = daysMap.get(date);
                const isSelected = selectedDate === date;
                return (
                  <button
                    key={date}
                    onClick={() => day && onSelectDay(day)}
                    onMouseEnter={() => setHovered(date)}
                    onMouseLeave={() => setHovered(null)}
                    disabled={!day}
                    title={day ? `${date} · ${day.records.length} activity` : date}
                    className={cn(
                      "relative aspect-square rounded-full transition-all",
                      !day && "bg-muted/40",
                      day?.level === 1 && "bg-wj-green/40 hover:bg-wj-green/60",
                      day?.level === 2 && "bg-wj-green/70 hover:bg-wj-green/90",
                      day?.level === 3 && "bg-wj-green hover:brightness-110",
                      day && "cursor-pointer",
                      isSelected && "ring-2 ring-wj-green ring-offset-2 ring-offset-card scale-110",
                      hovered === date && day && "scale-125",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Less</span>
          <span className="h-2.5 w-2.5 rounded-full bg-muted/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-wj-green/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-wj-green/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-wj-green" />
          <span>More</span>
        </div>
        <AnimatePresence>
          {busiest && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-wj-green" />
              Busiest day:{" "}
              <span className="text-foreground font-medium">
                {new Date(busiest.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
              · {busiest.records.length} activities
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}