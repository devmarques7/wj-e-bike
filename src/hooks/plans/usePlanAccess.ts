import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  parseEntitlements,
  EMPTY_ENTITLEMENTS,
  type PlanEntitlements,
} from "@/lib/plans/entitlements";

export type CurrentPlan = {
  subscriptionId: string;
  planId: string;
  planVersionId: string;
  slug: string;
  name: string;
  tierLevel: number;
  price: number;
  currency: string;
  interval: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlements: PlanEntitlements;
};

/** Feature keys any part of the app can gate on. */
export type PlanFeature =
  | "priority_booking"
  | "loaner_bike"
  | "pickup_delivery"
  | "insurance_included"
  | "concierge"
  | "urgent_service_included";

/**
 * Global plan authorizer. One place that answers "which plan am I on and what
 * am I allowed to do?" — every gated flow should read from here instead of
 * re-querying subscriptions.
 */
export function usePlanAccess(bikeId?: string | null) {
  const [plan, setPlan] = useState<CurrentPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setPlan(null);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("subscriptions")
      .select(
        "id, bike_id, plan_version_id, status, current_period_end, cancel_at_period_end, started_at, plan_versions(id, plan_id, price, currency, interval, entitlements, plans(id, slug, name, tier_level))",
      )
      .eq("user_id", uid)
      .in("status", ["active", "trialing", "past_due"])
      .order("started_at", { ascending: false });

    if (bikeId) query = query.eq("bike_id", bikeId);

    const { data } = await query.limit(1).maybeSingle();
    const v: any = (data as any)?.plan_versions;
    const p: any = v?.plans;

    setPlan(
      data && v && p
        ? {
            subscriptionId: (data as any).id,
            planId: p.id,
            planVersionId: v.id,
            slug: p.slug,
            name: p.name,
            tierLevel: p.tier_level ?? 0,
            price: Number(v.price ?? 0),
            currency: v.currency || "EUR",
            interval: v.interval || "monthly",
            status: (data as any).status,
            currentPeriodEnd: (data as any).current_period_end,
            cancelAtPeriodEnd: (data as any).cancel_at_period_end,
            entitlements: parseEntitlements(v.entitlements),
          }
        : null,
    );
    setLoading(false);
  }, [bikeId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const entitlements = plan?.entitlements ?? EMPTY_ENTITLEMENTS;

  const can = useCallback(
    (feature: PlanFeature) => Boolean(entitlements[feature]),
    [entitlements],
  );

  /** Compares any plan against the current one: current / upgrade / downgrade. */
  const compareTo = useCallback(
    (tierLevel: number, planId?: string | null): "current" | "upgrade" | "downgrade" => {
      if (planId && plan?.planId === planId) return "current";
      if (!plan) return "upgrade";
      if (tierLevel === plan.tierLevel) return "current";
      return tierLevel > plan.tierLevel ? "upgrade" : "downgrade";
    },
    [plan],
  );

  const isCurrentPlan = useCallback((planId: string) => plan?.planId === planId, [plan]);

  return useMemo(
    () => ({
      plan,
      planId: plan?.planId ?? null,
      tierLevel: plan?.tierLevel ?? -1,
      entitlements,
      loading,
      can,
      compareTo,
      isCurrentPlan,
      refetch,
    }),
    [plan, entitlements, loading, can, compareTo, isCurrentPlan, refetch],
  );
}
