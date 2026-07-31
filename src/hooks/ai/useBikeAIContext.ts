import { useCallback, useMemo } from "react";
import { useSelectedBike } from "@/contexts/SelectedBikeContext";
import { bikeScopePrompt, getBikeScope } from "@/lib/ai/bikeScope";

/**
 * Bike awareness for the AI assistant.
 *
 * Any assistant flow (booking, diagnosis, coverage, urgent service) can call
 * this to know exactly which bike the rider means without asking, and to
 * stamp the resulting appointment with the right `bike_id`.
 */
export function useBikeAIContext() {
  const { bike, bikes, selectBike, nextRevision, health } = useSelectedBike();

  /** Match a bike by model/serial mentioned in free text; falls back to the active bike. */
  const resolveBikeFromText = useCallback(
    (text: string) => {
      const q = (text || "").toLowerCase();
      const found = bikes.find(
        (b) =>
          (b.serial && q.includes(b.serial.toLowerCase())) ||
          (b.model && q.includes(b.model.toLowerCase())),
      );
      return found ?? bike;
    },
    [bikes, bike],
  );

  const summary = useMemo(() => {
    if (!bike) return "No bike registered yet.";
    return [
      `${bike.model}${bike.serial ? ` (${bike.serial})` : ""}`,
      `${bike.km} km`,
      `health ${health.overall}%`,
      nextRevision ? `next revision ${nextRevision.toLocaleDateString("en-GB")}` : "revision not scheduled",
    ].join(" · ");
  }, [bike, health.overall, nextRevision]);

  return {
    bike,
    bikes,
    bikeId: bike?.id ?? null,
    selectBike,
    summary,
    /** Text block appended to AI prompts. */
    promptContext: bikeScopePrompt(),
    resolveBikeFromText,
    /** Non-reactive read, useful inside async flows. */
    peek: getBikeScope,
  };
}
