/**
 * WJ reward points model.
 *
 * Single source of truth for how many points a member earns. The rules live in
 * the database (`reward_rules`) so admins can tune them, and every award is
 * written to `reward_points_ledger` (idempotent per appointment + rule), which
 * is what the E-Pass / wallet reads.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RewardRule {
  id: string;
  code: string;
  label: string;
  description: string | null;
  kind: "service" | "assessment" | "purchase" | "bonus" | string;
  base_points: number;
  points_per_eur: number;
  min_condition_score: number | null;
  multiplier: number;
  is_active: boolean;
}

export interface RewardLedgerEntry {
  id: string;
  user_id: string;
  bike_id: string | null;
  appointment_id: string | null;
  rule_code: string | null;
  source_type: string;
  source_id: string | null;
  points: number;
  base_points: number;
  multiplier: number;
  condition_score: number | null;
  description: string | null;
  created_at: string;
}

/**
 * Awards the points of a completed appointment: service points (from the
 * service type, with a configurable fallback), the final condition bonus and
 * the extra items/services purchased — all multiplied by the member plan.
 * Safe to call twice: the database ignores duplicates.
 */
export async function awardAppointmentPoints(
  appointmentId: string,
  conditionScore?: number | null,
): Promise<{ points: number; error: string | null }> {
  const { data, error } = await supabase.rpc("fn_award_appointment_points", {
    p_appointment_id: appointmentId,
    p_condition_score: conditionScore ?? null,
  });
  if (error) return { points: 0, error: error.message };
  return { points: Number(data ?? 0), error: null };
}

export async function fetchRewardRules(): Promise<RewardRule[]> {
  const { data } = await supabase
    .from("reward_rules")
    .select("*")
    .order("kind")
    .order("code");
  return (data as unknown as RewardRule[]) ?? [];
}

export const sumPoints = (entries: RewardLedgerEntry[]) =>
  entries.reduce((s, e) => s + (e.points ?? 0), 0);