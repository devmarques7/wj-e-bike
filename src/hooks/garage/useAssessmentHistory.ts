import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BikeAssessmentRecord } from "@/hooks/garage/useBikeAssessment";

/**
 * Full assessment history of a bike (all staff reviews, newest first).
 * Customers can read their own bike records via RLS.
 */
export function useAssessmentHistory(bikeId?: string | null) {
  const [records, setRecords] = useState<BikeAssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!bikeId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("bike_assessments")
      .select("*")
      .eq("bike_id", bikeId)
      .order("created_at", { ascending: false });
    setRecords((data as unknown as BikeAssessmentRecord[]) ?? []);
    setLoading(false);
  }, [bikeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { records, loading, refetch: load };
}
