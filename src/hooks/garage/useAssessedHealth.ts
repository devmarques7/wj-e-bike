import { useMemo } from "react";
import { useBikeAssessment } from "@/hooks/garage/useBikeAssessment";
import { mergeAssessedHealth, type MergedMetric } from "@/lib/garage/assessment";

/**
 * Reusable condition resolver: telemetry health + latest staff assessment,
 * returning the merged metrics and the single "Overall condition" percentage
 * shown across the Garage, the staff bike page and the E-Pass surfaces.
 */
export function useAssessedHealth(
  bikeId: string | null | undefined,
  metrics: MergedMetric[],
  customerId?: string | null,
) {
  const { assessment, loading, saving, save, refetch } = useBikeAssessment(bikeId, customerId);
  const merged = useMemo(
    () => mergeAssessedHealth(metrics, assessment),
    [metrics, assessment],
  );
  return { ...merged, assessment, loading, saving, save, refetch };
}
