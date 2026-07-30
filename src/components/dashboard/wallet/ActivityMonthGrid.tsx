import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityDay } from "@/hooks/wallet/useActivityYear";

interface Props {
  year: number;
  /** 0-11 */
  month: number;
  daysMap: Map<string, ActivityDay>;
  onMonthChange: (month: number) => void;
  onClose: () => void;
  onSelectDay: (day: ActivityDay) => void;
  selectedDate?: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Expanded month view (Apple-calendar style): large day dots, Monday-first grid.
 * A filled dot means the rider had activity that day; clicking opens the day sheet.
 */
export default function ActivityMonthGrid({
  year,
  month,
  daysMap,
  onMonthChange,
  onClose,
  onSelectDay,
  selectedDate,
}: Props) {
  const cells = useMemo(() => {
    const total = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
    const lead = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: total }, (_, i) => iso(year, month, i + 1));
    return [...lead, ...days];
  }, [year, month]);

  const monthActivity = useMemo(
    () =>
      Array.from(daysMap.values()).filter((d) => {
        const [y, m] = d.date.split("-").map(Number);
        return y === year && m - 1 === month;
      }),
    [daysMap, year, month],
  );
  const monthPoints = monthActivity.reduce((s, d) => s + d.points, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-3xl border border-border/50 bg-card p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-4xl font-bold tracking-tight text-foreground uppercase leading-none">
            {MONTH_NAMES[month]}
          </p>
          <p className="text-2xl font-semibold text-muted-foreground/70 leading-tight">{year}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {monthActivity.length} active {monthActivity.length === 1 ? "day" : "days"} · {monthPoints} points
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMonthChange((month + 11) % 12)}
            className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMonthChange((month + 1) % 12)}
            className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            aria-label="Back to year"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-2 text-center">
        {WEEK.map((d, i) => (
          <span key={i} className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((date, i) => {
          if (!date) return <span key={`lead-${i}`} />;
          const day = daysMap.get(date);
          const isSelected = selectedDate === date;
          const dayNum = Number(date.slice(-2));
          return (
            <button
              key={date}
              onClick={() => day && onSelectDay(day)}
              disabled={!day}
              className={cn(
                "relative aspect-square rounded-full flex items-center justify-center text-xs font-medium transition-all",
                day
                  ? "bg-wj-green text-white hover:brightness-110 cursor-pointer"
                  : "bg-muted/50 text-muted-foreground/60",
                day && day.level >= 3 && "ring-2 ring-wj-green/40 ring-offset-2 ring-offset-card",
                isSelected && "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}