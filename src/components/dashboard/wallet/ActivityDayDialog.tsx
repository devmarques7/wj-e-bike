import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Wrench, ShoppingBag, RotateCcw, Sparkles, HeartPulse, FileText, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityDay, ActivityRecord } from "@/hooks/wallet/useActivityYear";

interface Props {
  day: ActivityDay | null;
  onOpenChange: (open: boolean) => void;
  onOpenRecord: (record: ActivityRecord) => void;
  /** Overall bike condition (0-100) shown as the closing quality block. */
  healthScore?: number;
  bikeName?: string;
}

const KIND_ICON = {
  service: Wrench,
  repair: Wrench,
  revision: RotateCcw,
  purchase: ShoppingBag,
} as const;

/**
 * Day sheet (Apple-calendar reference): huge day number, one dot per thing done that day,
 * the booking briefing right below, then every folder/point earned and the bike quality.
 */
export default function ActivityDayDialog({
  day,
  onOpenChange,
  onOpenRecord,
  healthScore,
  bikeName,
}: Props) {
  const date = day ? new Date(day.date) : null;
  const briefing = day?.records.find((r) => r.briefing)?.briefing;

  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl">
        <DialogHeader className="space-y-0">
          <DialogTitle className="sr-only">
            {date?.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>

        {day && date && (
          <div className="space-y-5">
            {/* Big day header */}
            <div>
              <div className="flex items-end justify-between gap-4">
                <span className="text-7xl font-bold tracking-tighter text-foreground leading-none tabular-nums">
                  {String(date.getDate()).padStart(2, "0")}
                </span>
                <span className="text-lg font-medium text-muted-foreground">
                  {date.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
              </div>
              <p className="text-lg font-semibold uppercase tracking-tight text-foreground mt-1">
                {date.toLocaleDateString("en-GB", { month: "long" })}{" "}
                <span className="text-muted-foreground/70">{date.getFullYear()}</span>
              </p>

              {/* One dot per thing done that day */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {day.records.map((r) => (
                  <span
                    key={r.id}
                    title={r.title}
                    className={cn(
                      "h-3.5 w-3.5 rounded-full",
                      r.status === "completed" ? "bg-wj-green" : "bg-muted-foreground/40",
                    )}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  {day.records.length} {day.records.length === 1 ? "activity" : "activities"} · +{day.points} points
                </span>
              </div>
            </div>

            {/* Briefing of the booking */}
            <section className="rounded-2xl border border-border/50 bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-wj-green" />
                <h4 className="text-sm font-semibold text-foreground">Booking briefing</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {briefing || "No briefing was registered for this day's booking."}
              </p>
            </section>

            {/* Folders of the day */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-wj-green" />
                <h4 className="text-sm font-semibold text-foreground">What was done</h4>
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
                    className="w-full text-left rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition p-4 flex items-center gap-3"
                  >
                    <span className="h-9 w-9 rounded-xl bg-wj-green/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-wj-green" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground truncate">{r.title}</span>
                      <span className="block text-xs text-muted-foreground capitalize">
                        {r.status.replace("_", " ")}
                        {r.extraCharge > 0 ? ` · parts & repairs €${r.extraCharge.toFixed(2)}` : ""}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-wj-green">+{r.points}</span>
                  </motion.button>
                );
              })}
            </section>

            {/* Totals */}
            <div className="flex items-center gap-2 rounded-2xl bg-wj-green/10 px-4 py-3">
              <Sparkles className="h-4 w-4 text-wj-green" />
              <span className="text-sm text-foreground font-medium">+{day.points} points earned</span>
              <span className="text-xs text-muted-foreground ml-auto">
                €{day.records.reduce((s, r) => s + r.extraCharge, 0).toFixed(2)} in parts & repairs
              </span>
            </div>

            {/* Bike quality closing block */}
            {typeof healthScore === "number" && (
              <section className="rounded-2xl border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <HeartPulse className="h-4 w-4 text-wj-green" />
                  <h4 className="text-sm font-semibold text-foreground">Bike quality after this day</h4>
                  <span className="ml-auto text-sm font-semibold text-wj-green">{healthScore}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${healthScore}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full bg-wj-green"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{bikeName || "Your bike"} overall condition</p>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}