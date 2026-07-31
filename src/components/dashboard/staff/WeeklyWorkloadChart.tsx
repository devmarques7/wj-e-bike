import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffWeekWorkload } from "@/hooks/staff/useStaffWeekWorkload";

const LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  userId: string | undefined;
}

/** Weekly bar chart showing which days are the busiest for this mechanic. */
export default function WeeklyWorkloadChart({ userId }: Props) {
  const { days, loading } = useStaffWeekWorkload(userId);
  const busiest = days.reduce(
    (best, d) => (d.pct > (best?.pct ?? -1) ? d : best),
    null as (typeof days)[number] | null,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="h-full rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md p-5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-wj-green" />
          <h3 className="text-sm font-medium text-foreground">Week analytics</h3>
        </div>
        {busiest && busiest.pct > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Busiest ·{" "}
            {new Date(busiest.date + "T00:00:00").toLocaleDateString("en-GB", {
              weekday: "short",
            })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 min-h-[140px] animate-pulse rounded-2xl bg-muted/30" />
      ) : (
        <div className="flex-1 min-h-[140px] flex items-end gap-1.5 sm:gap-2.5">
          {days.map((d) => {
            const h = d.isOff ? 6 : Math.max(6, d.pct);
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full">
                <div className="relative flex-1 w-full flex items-end">
                  <div
                    className={cn(
                      "w-full rounded-xl overflow-hidden bg-muted/30 flex items-end",
                      d.isToday && "ring-1 ring-wj-green/40",
                    )}
                    style={{ height: "100%" }}
                    title={`${d.jobs} jobs · ${d.pct}%`}
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className={cn(
                        "w-full rounded-xl",
                        d.isOff
                          ? "bg-muted/50"
                          : d.pct > 90
                            ? "bg-destructive/70"
                            : d.pct > 70
                              ? "bg-amber-500/70"
                              : d.isToday
                                ? "bg-wj-green"
                                : "bg-wj-green/45",
                      )}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase",
                    d.isToday ? "text-wj-green font-semibold" : "text-muted-foreground",
                  )}
                >
                  {LABELS[d.dow]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Booked vs capacity</span>
        <span className="tabular-nums">
          {days.reduce((s, d) => s + d.jobs, 0)} jobs this week
        </span>
      </div>
    </motion.div>
  );
}