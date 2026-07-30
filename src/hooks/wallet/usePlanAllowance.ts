import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Number of plan-covered services included per 12-month cycle, per plan slug.
 * Mirrors the commercial rules of the WJ membership tiers.
 */
export const PLAN_SERVICE_ALLOWANCE: Record<string, number> = {
  free: 1,
  light: 2,
  plus: 4,
  black: 6,
};

export interface PlanAllowance {
  /** Services included by the active plan in the current 12-month cycle. */
  total: number;
  /** Services already completed within the cycle. */
  used: number;
  /** Services booked but not completed yet. */
  scheduled: number;
  /** Services still available to book. */
  remaining: number;
  loading: boolean;
}

/**
 * Validates how many plan-covered appointments the rider has used, scheduled and
 * still has available in the running 12-month membership cycle.
 */
export function usePlanAllowance(planSlug: string | undefined): PlanAllowance {
  const { user } = useAuth();
  const [used, setUsed] = useState(0);
  const [scheduled, setScheduled] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const { data } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("user_id", user.id)
        .gte("scheduled_date", from.toISOString().slice(0, 10));

      if (cancelled) return;
      const rows = data ?? [];
      setUsed(rows.filter((r: any) => r.status === "completed").length);
      setScheduled(
        rows.filter((r: any) => ["pending", "confirmed", "in_progress"].includes(r.status)).length,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return useMemo(() => {
    const total = PLAN_SERVICE_ALLOWANCE[planSlug ?? "free"] ?? 1;
    return {
      total,
      used,
      scheduled,
      remaining: Math.max(0, total - used - scheduled),
      loading,
    };
  }, [planSlug, used, scheduled, loading]);
}