import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  fetchAvailability,
  toDateKey,
  type AvailableSlot,
} from "@/lib/scheduling/availability";

/**
 * Reusable "rook" for slot validation.
 *
 * Answers one question everywhere in the app: *what is the earliest real slot
 * I can put this bike into?* It walks widening horizons — today first, then
 * next week, then next month — and stops at the first one with free capacity,
 * so a late (overdue) task always lands on the earliest possible time.
 *
 * Who is logged in matters: a staff mechanic only sees slots inside their own
 * shift/workload (their mechanic id is passed to `get_available_slots`), while
 * admins and riders see the whole workshop availability.
 */
export type SlotHorizon = "today" | "week" | "month";

export interface RescueSlot extends AvailableSlot {
  date: string;
  label: string;
  horizon: SlotHorizon;
}

interface Options {
  serviceTypeId?: string | null;
  /** Only search when true (e.g. dialog open). */
  enabled?: boolean;
  /** Max slots returned, earliest first. */
  limit?: number;
  /** Force a mechanic scope; defaults to the logged-in staff member. */
  mechanicId?: string | null;
}

const HORIZONS: { horizon: SlotHorizon; offset: number; days: number }[] = [
  { horizon: "today", offset: 0, days: 1 },
  { horizon: "week", offset: 1, days: 7 },
  { horizon: "month", offset: 8, days: 30 },
];

export function useRescueSlots({
  serviceTypeId,
  enabled = true,
  limit = 9,
  mechanicId,
}: Options) {
  const { user } = useAuth();
  const { isStaff } = usePermissions();
  const scopedMechanicId =
    mechanicId !== undefined ? mechanicId : isStaff ? (user?.id ?? null) : null;

  const [slots, setSlots] = useState<RescueSlot[]>([]);
  const [horizon, setHorizon] = useState<SlotHorizon | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !serviceTypeId) {
      setSlots([]);
      setHorizon(null);
      return;
    }
    setLoading(true);
    try {
      for (const h of HORIZONS) {
        const from = new Date();
        from.setDate(from.getDate() + h.offset);
        let days = await fetchAvailability(serviceTypeId, h.days, from, scopedMechanicId);
        // A staff member with no personal shift falls back to the workshop.
        if (!days.length && scopedMechanicId) {
          days = await fetchAvailability(serviceTypeId, h.days, from, null);
        }
        const flat: RescueSlot[] = days
          .flatMap((d) =>
            d.slots.map((s) => ({ ...s, date: d.date, label: d.label, horizon: h.horizon })),
          )
          .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
          .slice(0, limit);
        if (flat.length) {
          setSlots(flat);
          setHorizon(h.horizon);
          return;
        }
      }
      setSlots([]);
      setHorizon(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, serviceTypeId, scopedMechanicId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    slots,
    horizon,
    loading,
    reload: load,
    todayKey: toDateKey(new Date()),
    mechanicScoped: Boolean(scopedMechanicId),
  };
}
