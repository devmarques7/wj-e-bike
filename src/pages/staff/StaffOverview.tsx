import { motion } from "framer-motion";
import { Wrench, Calendar, Star, Clock } from "lucide-react";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import StaffKPICard from "@/components/dashboard/StaffKPICard";
import KPICarousel from "@/components/dashboard/KPICarousel";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import ShiftTracker from "@/components/dashboard/ShiftTracker";
import StaffWorkloadMeter from "@/components/dashboard/StaffWorkloadMeter";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useShift } from "@/hooks/useShift";
import { useStaffOverviewStats } from "@/hooks/staff/useStaffOverviewStats";

export default function StaffOverview() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const stats = useStaffOverviewStats(user?.id);
  const { elapsedSec, status: shiftStatus } = useShift();

  if (isLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.role !== "staff") {
    return <Navigate to="/dashboard" replace />;
  }

  const todayDelta = stats.tasksCompletedToday - stats.tasksCompletedYesterday;
  const serviceDelta =
    stats.avgServiceMinutes != null
      ? stats.avgServiceMinutes - stats.avgServiceTargetMinutes
      : null;
  const shiftHours = Math.floor(elapsedSec / 3600);
  const shiftMins = Math.floor((elapsedSec % 3600) / 60);
  const shiftNotStarted = shiftStatus === "idle" || elapsedSec <= 0;
  const shiftLabel = shiftNotStarted
    ? "00:00m"
    : `${String(shiftHours).padStart(2, "0")}:${String(shiftMins).padStart(2, "0")}m`;

  const kpiData = [
    {
      label: "Tasks Completed",
      value: String(stats.tasksCompletedToday),
      change:
        todayDelta === 0
          ? "Same as yesterday"
          : `${todayDelta > 0 ? "+" : ""}${todayDelta} vs yesterday`,
      trend: (todayDelta >= 0 ? "up" : "down") as "up" | "down" | "neutral",
      icon: Wrench,
    },
    {
      label: "Appointments Today",
      value: String(stats.appointmentsToday),
      change: `${stats.appointmentsRemaining} remaining`,
      trend: "neutral" as const,
      icon: Calendar,
    },
    {
      label: "Current Shift",
      value: shiftLabel,
      change:
        shiftStatus === "active"
          ? "Clocked in"
          : shiftStatus === "paused"
          ? "On break"
          : shiftStatus === "completed"
          ? "Clocked out"
          : "Swipe to clock in",
      trend: (shiftStatus === "active" ? "up" : "neutral") as
        | "up"
        | "down"
        | "neutral",
      icon: Star,
      pending: shiftNotStarted,
    },
    {
      label: "Avg. Service Time",
      value:
        stats.avgServiceMinutes != null ? `${stats.avgServiceMinutes}m` : "—",
      change:
        serviceDelta == null
          ? "No data yet"
          : `${serviceDelta > 0 ? "+" : ""}${serviceDelta}m vs target`,
      trend: (serviceDelta != null && serviceDelta <= 0 ? "up" : "down") as
        | "up"
        | "down"
        | "neutral",
      icon: Clock,
    },
  ];

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-2"
        >
          <h1 className="text-xl sm:text-2xl font-light text-foreground">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's your workshop overview for today
          </p>
        </motion.div>

        {/* KPI Cards - carousel on mobile, grid on desktop */}
        <KPICarousel>
          {kpiData.map((kpi, index) => (
            <StaffKPICard key={kpi.label} {...kpi} index={index} />
          ))}
        </KPICarousel>

        {/* Mobile: ShiftTracker sits alone right below the KPIs */}
        <div className="lg:hidden min-h-[200px]">
          <ShiftTracker />
        </div>

        {/* Main Content Grid - 12 Columns */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6 h-full">
          {/* Appointments / tasks table - 8 columns (same as Admin Workshop) */}
          <div className="col-span-12 lg:col-span-8 h-full min-h-[500px]">
            <AppointmentsTableCard mineOnlyMechanicId={user?.id} />
          </div>

          {/* Right Sidebar - 4 columns (stacked) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 lg:gap-6 h-full">
            {/* Shift Tracker - desktop only; mobile instance lives above the grid */}
            <div className="hidden lg:block min-h-[200px] flex-1">
              <ShiftTracker />
            </div>

            {/* Workload Meter (preserved & relocated into unified layout) */}
            <StaffWorkloadMeter
              currentLoad={stats.currentLoadPct}
              weeklyHours={stats.weeklyHours}
              targetHours={stats.targetHours || 40}
              completedToday={stats.completedToday}
              totalToday={stats.totalToday}
            />
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  );
}