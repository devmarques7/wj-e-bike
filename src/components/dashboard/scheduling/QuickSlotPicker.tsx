import { CalendarClock, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRescueSlots, type SlotHorizon } from "@/hooks/scheduling/useRescueSlots";

interface Props {
  serviceTypeId?: string | null;
  enabled?: boolean;
  /** Highlights the block as an urgent recovery for a late task. */
  urgent?: boolean;
  selected?: { date: string; start: string } | null;
  onSelect: (slot: { date: string; start: string; mechanicId: string | null }) => void;
}

const HORIZON_LABEL: Record<SlotHorizon, string> = {
  today: "Earliest today",
  week: "Earliest next week",
  month: "Earliest next month",
};

/**
 * Direct, clickable availability. Uses the shared slot "rook", so the times
 * shown are always real capacity for whoever is logged in (a staff mechanic
 * sees their own workload first).
 */
export default function QuickSlotPicker({
  serviceTypeId,
  enabled = true,
  urgent = false,
  selected,
  onSelect,
}: Props) {
  const { slots, horizon, loading, mechanicScoped } = useRescueSlots({
    serviceTypeId,
    enabled,
  });

  if (!serviceTypeId) return null;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 space-y-2",
        urgent ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {urgent ? (
            <Zap className="h-3 w-3 text-amber-400" />
          ) : (
            <CalendarClock className="h-3 w-3 text-wj-green" />
          )}
          {urgent ? "Overdue — recover now" : "Available slots"}
        </span>
        {horizon && (
          <span className="text-[10px] text-muted-foreground">{HORIZON_LABEL[horizon]}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Checking workload…
        </div>
      ) : slots.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-1">
          No free capacity in the next 30 days — pick a date manually below.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => {
            const active = selected?.date === s.date && selected?.start === s.start;
            return (
              <button
                key={`${s.date}-${s.start}`}
                type="button"
                onClick={() =>
                  onSelect({ date: s.date, start: s.start, mechanicId: s.mechanicId })
                }
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
                  active
                    ? "border-wj-green bg-wj-green/20 text-wj-green"
                    : "border-border/40 hover:border-wj-green/60 hover:bg-wj-green/10",
                )}
              >
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                {s.start.slice(0, 5)}
              </button>
            );
          })}
        </div>
      )}

      {mechanicScoped && (
        <p className="text-[9px] text-muted-foreground">Based on your own shift availability.</p>
      )}
    </div>
  );
}
