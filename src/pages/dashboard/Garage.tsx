import { useMemo } from "react";
import { motion } from "framer-motion";
import { Navigate, useSearchParams } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import BikeAssistantCard from "@/components/dashboard/assistant/BikeAssistantCard";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import GarageBikeCard from "@/components/dashboard/garage/GarageBikeCard";
import BikeHealthGrid from "@/components/dashboard/garage/BikeHealthGrid";
import ServiceCountdown from "@/components/dashboard/ServiceCountdown";
import { useAuth } from "@/contexts/AuthContext";
import { useGarageBike } from "@/hooks/garage/useGarageBike";

export default function Garage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const { bikes, bike, selectBike, health } = useGarageBike(params.get("bike"));

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
            <GarageBikeCard bike={bike} overall={health.overall} metrics={health.metrics} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <ServiceCountdown />
          </div>

          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 lg:gap-6">
            <div className="flex-none">
              <AppointmentsTableCard
                customerUserId={user?.id}
                includeRequests
                title="Service history & requests"
              />
            </div>
            <div className="flex-1 min-h-0">
              <BikeHealthGrid metrics={health.metrics} />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <BikeAssistantCard className="h-full" />
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  );
}
