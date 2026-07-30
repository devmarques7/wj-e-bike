import { motion } from "framer-motion";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import BikeShowcase from "@/components/dashboard/BikeShowcase";
import ServiceRequestCard from "@/components/dashboard/ServiceRequestCard";
import WalletCard from "@/components/dashboard/WalletCard";
import ServiceCountdown from "@/components/dashboard/ServiceCountdown";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import AccessoryCarousel from "@/components/dashboard/AccessoryCarousel";
import BikeAssistantCard from "@/components/dashboard/assistant/BikeAssistantCard";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.mustCompleteProfile) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/dashboard/admin" replace />;
  }

  if (user?.role === "staff") {
    return <Navigate to="/dashboard/staff" replace />;
  }

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* 12 Column Grid Layout */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {/* Bike Showcase - Columns 1-5 */}
          <div className="col-span-12 lg:col-span-5">
            <BikeShowcase />
          </div>

          {/* Middle Section - Columns 6-8 */}
          <div className="col-span-12 lg:col-span-3 grid grid-rows-2 gap-4 lg:gap-6">
            <ServiceRequestCard />
            <WalletCard />
          </div>

          {/* Service Countdown - Columns 9-12 */}
          <div className="col-span-12 lg:col-span-4">
            <ServiceCountdown />
          </div>
        </div>

        {/* AI Bike Assistant + Accessory Carousel */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <div className="col-span-12 lg:col-span-8">
            <BikeAssistantCard />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <AccessoryCarousel />
          </div>
        </div>

        {/* Appointments - full width */}
        <div className="w-full lg:h-[420px] xl:h-[480px]">
          {user?.id ? (
            <AppointmentsTableCard customerUserId={user.id} />
          ) : null}
        </div>
      </div>
    </RoleDashboardLayout>
  );
}
