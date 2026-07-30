import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutGrid, Rows3 } from "lucide-react";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import MembershipPlanCard from "@/components/dashboard/membership/MembershipPlanCard";
import ComparePlansTable from "@/components/dashboard/membership/ComparePlansTable";
import UpgradeCheckoutModal from "@/components/dashboard/membership/UpgradeCheckoutModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePlans, type PlanWithActiveVersion } from "@/hooks/plans/usePlansData";
import { useMyMembership } from "@/hooks/plans/useMyMembership";

export default function Membership() {
  const { isAuthenticated, isLoading } = useAuth();
  const { plans, loading } = usePlans();
  const { membership } = useMyMembership();
  const [mode, setMode] = useState<"cards" | "compare">("cards");
  const [selected, setSelected] = useState<PlanWithActiveVersion | null>(null);

  const activePlans = useMemo(
    () => plans.filter((p) => p.is_active).sort((a, b) => a.tier_level - b.tier_level),
    [plans],
  );
  const currentPlanId = membership?.planId ?? null;

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-wj-green">Membership</p>
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground mt-1">
              Choose the ride that fits you
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentPlanId
                ? "Compare what you have today with everything else we offer."
                : "Every WJ membership, with service, perks and pricing side by side."}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full border border-border/40 bg-background/50 backdrop-blur-xl">
            {([
              { id: "cards", label: "Plans", icon: LayoutGrid },
              { id: "compare", label: "Compare plans", icon: Rows3 },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 h-9 rounded-full text-xs font-medium transition-colors",
                  mode === t.id
                    ? "bg-wj-green/15 text-wj-green"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80 rounded-3xl" />
            ))}
          </div>
        ) : activePlans.length === 0 ? (
          <div className="rounded-3xl border border-border/40 p-10 text-center text-muted-foreground">
            No memberships available right now.
          </div>
        ) : mode === "cards" ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {activePlans.map((p, i) => (
              <MembershipPlanCard
                key={p.id}
                plan={p}
                index={i}
                isCurrent={p.id === currentPlanId}
                onSelect={setSelected}
              />
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <ComparePlansTable
              plans={activePlans}
              currentPlanId={currentPlanId}
              onSelect={setSelected}
            />
          </motion.div>
        )}
      </div>

      <UpgradeCheckoutModal
        plan={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </RoleDashboardLayout>
  );
}