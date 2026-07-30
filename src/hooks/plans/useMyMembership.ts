import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MyMembership = {
  subscriptionId: string;
  planVersionId: string;
  planId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/** Current signed-in user's active subscription (if any). */
export function useMyMembership() {
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setMembership(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("id, plan_version_id, status, current_period_end, cancel_at_period_end, plan_versions(plan_id)")
      .eq("user_id", uid)
      .in("status", ["active", "trialing", "past_due"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setMembership(
      data
        ? {
            subscriptionId: data.id,
            planVersionId: data.plan_version_id,
            planId: (data as any).plan_versions?.plan_id ?? null,
            status: data.status,
            currentPeriodEnd: data.current_period_end,
            cancelAtPeriodEnd: data.cancel_at_period_end,
          }
        : null,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { membership, loading, refetch };
}