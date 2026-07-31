import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseEntitlements, type PlanEntitlements } from "@/lib/plans/entitlements";

export type PlanOption = {
  planId: string;
  planVersionId: string;
  slug: string;
  name: string;
  tierLevel: number;
  price: number;
  currency: string;
  interval: string;
  trialDays: number;
  features: string[];
  description: string | null;
  entitlements: PlanEntitlements;
};

export type BikePlan = {
  subscriptionId: string | null;
  bikeId: string;
  /** Plan currently billed for this bike. */
  plan: PlanOption | null;
  /** Plan requested but awaiting payment. */
  pendingPlan: PlanOption | null;
  status: string | null;
  currentPeriodEnd: string | null;
};

const ACTIVE = ["trialing", "active", "past_due"] as const;

/**
 * Per-bike membership state. Every registered bike (E-Pass card) carries its
 * own subscription; bikes without one inherit the rider's current plan through
 * `fn_sync_bike_subscriptions`.
 */
export function useBikeSubscriptions(userId: string | undefined, bikeIds: string[]) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [byBike, setByBike] = useState<Record<string, BikePlan>>({});
  const [fallback, setFallback] = useState<PlanOption | null>(null);
  const [loading, setLoading] = useState(true);

  const key = bikeIds.join(",");

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: rawPlans } = await supabase
      .from("plans")
      .select(
        "id, slug, name, tier_level, description, is_active, plan_versions:plan_versions(id, price, currency, interval, trial_days, features, entitlements, status, version_number)",
      )
      .eq("is_active", true)
      .order("tier_level", { ascending: true });

    const options: PlanOption[] = (rawPlans ?? [])
      .map((p: any) => {
        const v = (p.plan_versions ?? [])
          .filter((x: any) => x.status === "active")
          .sort((a: any, b: any) => b.version_number - a.version_number)[0];
        if (!v) return null;
        return {
          planId: p.id,
          planVersionId: v.id,
          slug: p.slug,
          name: p.name,
          tierLevel: p.tier_level ?? 0,
          price: Number(v.price ?? 0),
          currency: v.currency || "EUR",
          interval: v.interval || "monthly",
          trialDays: v.trial_days ?? 0,
          features: Array.isArray(v.features) ? v.features : [],
          description: p.description,
          entitlements: parseEntitlements(v.entitlements),
        } as PlanOption;
      })
      .filter(Boolean) as PlanOption[];

    setPlans(options);

    // Make sure every active bike inherits the rider's plan.
    if (bikeIds.length) {
      await supabase.rpc("fn_sync_bike_subscriptions", { p_user_id: userId });
    }

    const { data: subs } = await supabase
      .from("subscriptions")
      .select(
        "id, bike_id, plan_version_id, pending_plan_version_id, status, current_period_end, created_at",
      )
      .eq("user_id", userId)
      .in("status", ACTIVE)
      .order("created_at", { ascending: false });

    const byVersion = new Map(options.map((o) => [o.planVersionId, o]));
    const map: Record<string, BikePlan> = {};
    let base: PlanOption | null = null;

    (subs ?? []).forEach((s: any) => {
      const plan = byVersion.get(s.plan_version_id) ?? null;
      if (!base) base = plan;
      if (!s.bike_id) return;
      if (map[s.bike_id]) return;
      map[s.bike_id] = {
        subscriptionId: s.id,
        bikeId: s.bike_id,
        plan,
        pendingPlan: s.pending_plan_version_id ? byVersion.get(s.pending_plan_version_id) ?? null : null,
        status: s.status,
        currentPeriodEnd: s.current_period_end,
      };
    });

    setFallback(base ?? options.find((o) => o.slug === "free") ?? null);
    setByBike(map);
    setLoading(false);
  }, [userId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const planForBike = useCallback(
    (bikeId: string | null | undefined): PlanOption | null =>
      (bikeId && byBike[bikeId]?.plan) || fallback,
    [byBike, fallback],
  );

  const pendingForBike = useCallback(
    (bikeId: string | null | undefined): PlanOption | null =>
      (bikeId && byBike[bikeId]?.pendingPlan) || null,
    [byBike],
  );

  /** Requests a plan change for one bike. Paid plans stay pending until payment. */
  const requestChange = useCallback(
    async (bikeId: string, planVersionId: string) => {
      const { error } = await supabase.rpc("fn_request_bike_plan_change", {
        p_bike_id: bikeId,
        p_plan_version_id: planVersionId,
      });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const cancelPending = useCallback(
    async (bikeId: string) => {
      const { error } = await supabase.rpc("fn_cancel_pending_bike_plan", { p_bike_id: bikeId });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.tierLevel - b.tierLevel), [plans]);

  return { plans: sortedPlans, byBike, loading, planForBike, pendingForBike, requestChange, cancelPending, refetch: load };
}
