import { useMemo } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import BikeAssistantCard from "@/components/dashboard/assistant/BikeAssistantCard";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import GarageBikeCard from "@/components/dashboard/garage/GarageBikeCard";
import BikeHealthGrid from "@/components/dashboard/garage/BikeHealthGrid";
import ServiceCountdown from "@/components/dashboard/ServiceCountdown";
import BikeTabs from "@/components/dashboard/BikeTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedBike } from "@/contexts/SelectedBikeContext";
import { useAssessedHealth } from "@/hooks/garage/useAssessedHealth";

export default function Garage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { bikes, bike, selectBike, health } = useSelectedBike();
  /* Overall condition = telemetry health merged with the latest staff assessment. */
  const condition = useAssessedHealth(bike?.id ?? null, health.metrics);

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
          {bikeTabs.length > 0 && (
            <BikeTabs bikes={bikeTabs} activeId={bike?.id} onSelect={selectBike} />
          )}
        </motion.div>

        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <div className="col-span-12 lg:col-span-8">
            <GarageBikeCard
              bike={bike}
              overall={condition.overall}
              metrics={condition.metrics}
            />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <ServiceCountdown bikeId={bike?.id} />
          </div>

          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 lg:gap-6">
            <div className="flex-1 min-h-0">
              <BikeHealthGrid metrics={condition.metrics} assessment={condition.assessment} />
            </div>
            <div className="flex-none">
              <AppointmentsTableCard
                customerUserId={user?.id}
                bikeId={bike?.id ?? null}
                includeRequests
                title={bike ? `Service history — ${bike.model}` : "Service history & requests"}
              />
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
