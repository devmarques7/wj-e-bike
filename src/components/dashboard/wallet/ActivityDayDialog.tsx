import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Wrench, ShoppingBag, RotateCcw, Sparkles } from "lucide-react";
import type { ActivityDay, ActivityRecord } from "@/hooks/wallet/useActivityYear";

interface Props {
  day: ActivityDay | null;
  onOpenChange: (open: boolean) => void;
  onOpenRecord: (record: ActivityRecord) => void;
}

const KIND_ICON = {
  service: Wrench,
  repair: Wrench,
  revision: RotateCcw,
  purchase: ShoppingBag,
} as const;

/** Breakdown of everything that happened on a single day and the points it generated. */
export default function ActivityDayDialog({ day, onOpenChange, onOpenRecord }: Props) {
  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {day &&
              new Date(day.date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
          </DialogTitle>
        </DialogHeader>

        {day && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl bg-wj-green/10 px-4 py-3">
              <Sparkles className="h-4 w-4 text-wj-green" />
              <span className="text-sm text-foreground font-medium">+{day.points} points</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {day.records.length} {day.records.length === 1 ? "activity" : "activities"}
              </span>
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
                    <span className="block text-xs text-muted-foreground capitalize">{r.status}</span>
                  </span>
                  <span className="text-sm font-semibold text-wj-green">+{r.points}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}