import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Navigate, useSearchParams } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import BikeAssistantCard from "@/components/dashboard/assistant/BikeAssistantCard";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import GarageBikeCard from "@/components/dashboard/garage/GarageBikeCard";
import BikeHealthGrid from "@/components/dashboard/garage/BikeHealthGrid";
import RevisionCycleCard from "@/components/dashboard/garage/RevisionCycleCard";
import ServiceCountdown from "@/components/dashboard/ServiceCountdown";
import { useAuth } from "@/contexts/AuthContext";
import { useGarageBike } from "@/hooks/garage/useGarageBike";
import { useMyMembership } from "@/hooks/plans/useMyMembership";
import { supabase } from "@/integrations/supabase/client";

/** Fallback revision allowance per plan tier when the plan has no explicit value. */
const TIER_REVISIONS: Record<number, number> = { 0: 1, 1: 2, 2: 4, 3: 6 };

export default function Garage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const { bikes, bike, selectBike, health, nextRevision, daysToRevision } = useGarageBike(
    params.get("bike"),
  );
  const { membership } = useMyMembership();

  const [planName, setPlanName] = useState<string | null>(null);
  const [revisionsIncluded, setRevisionsIncluded] = useState(1);
  const [revisionsUsed, setRevisionsUsed] = useState(0);

  useEffect(() => {
    if (!membership?.planVersionId) {
      setPlanName(null);
      setRevisionsIncluded(1);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("plan_versions")
        .select("features, plans(name, tier_level)")
        .eq("id", membership.planVersionId)
        .maybeSingle();
      if (cancelled || !data) return;
      const plan = (data as any).plans;
      const features = (data as any).features ?? {};
      const included =
        Number(features.revisions_included ?? features.revisions ?? NaN) ||
        TIER_REVISIONS[plan?.tier_level ?? 0] ||
        1;
      setPlanName(plan?.name ?? null);
      setRevisionsIncluded(included);
    })();
    return () => {
      cancelled = true;
    };
  }, [membership?.planVersionId]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const from = new Date();
      from.setMonth(from.getMonth() - 12);
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("scheduled_date", from.toISOString().slice(0, 10));
      if (!cancelled) setRevisionsUsed(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const bikeTabs = useMemo(() => bikes ?? [], [bikes]);

  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role === "admin") return <Navigate to="/dashboard/admin" replace />;

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-light text-foreground">Garage</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Everything about your registered bike — health, revisions and history
            </p>
          </div>
          {bikeTabs.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {bikeTabs.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBike(b.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    bike?.id === b.id
                      ? "border-wj-green/50 bg-wj-green/10 text-foreground"
                      : "border-border/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b.model}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <div className="col-span-12 lg:col-span-8">
            <GarageBikeCard bike={bike} overall={health.overall} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <ServiceCountdown />
          </div>

          <div className="col-span-12">
            <RevisionCycleCard
              nextRevision={nextRevision}
              daysToRevision={daysToRevision}
              lastServiceAt={bike?.last_service_at ?? null}
              planName={planName}
              revisionsIncluded={revisionsIncluded}
              revisionsUsed={revisionsUsed}
            />
          </div>

          <div className="col-span-12 lg:col-span-8">
            <BikeHealthGrid metrics={health.metrics} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <BikeAssistantCard />
          </div>

          <div className="col-span-12">
            <AppointmentsTableCard
              customerUserId={user?.id}
              includeRequests
              title="Service history & requests"
            />
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  );
}