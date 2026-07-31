import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeAssessment,
  type AssessmentAnswers,
} from "@/lib/garage/assessment";

export interface BikeAssessmentRecord {
  id: string;
  bike_id: string;
  origin: string;
  is_second_hand: boolean;
  answers: AssessmentAnswers;
  scores: Record<string, number>;
  overall_score: number;
  condition_label: string;
  notes: string | null;
  created_at: string;
}

/**
 * Loads the latest staff condition assessment for a bike and lets
 * staff/admin register a new one (unique, timestamped record per bike).
 */
export function useBikeAssessment(bikeId?: string | null, customerId?: string | null) {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<BikeAssessmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!bikeId) {
      setAssessment(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("bike_assessments")
      .select("*")
      .eq("bike_id", bikeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAssessment((data as unknown as BikeAssessmentRecord) ?? null);
    setLoading(false);
  }, [bikeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (answers: AssessmentAnswers, notes?: string) => {
      if (!bikeId) return { error: "No bike selected." };
      setSaving(true);
      const result = computeAssessment(answers);
      const { error } = await supabase.from("bike_assessments").insert({
        bike_id: bikeId,
        customer_id: customerId ?? null,
        origin: result.origin,
        is_second_hand: result.isSecondHand,
        answers: answers as Record<string, string>,
        scores: result.scores,
        overall_score: result.overall,
        condition_label: result.label,
        notes: notes?.trim() || null,
        assessed_by: user?.id ?? null,
      });
      setSaving(false);
      if (error) return { error: error.message };
      await load();
      return { error: null, result };
    },
    [bikeId, customerId, user?.id, load],
  );

  return { assessment, loading, saving, save, refetch: load };
}