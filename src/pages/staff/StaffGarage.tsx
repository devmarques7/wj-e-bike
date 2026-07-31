import { useState } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { Bike, Wrench, AlertTriangle, CheckCircle2, Clock, Gauge, CalendarDays, UserCheck } from "lucide-react";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import StaffKPICard from "@/components/dashboard/StaffKPICard";
import KPICarousel from "@/components/dashboard/KPICarousel";
import GarageAssistantCard from "@/components/dashboard/garage/GarageAssistantCard";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffGarageStats, GARAGE_PERIODS, type GaragePeriod } from "@/hooks/staff/useStaffGarageStats";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const fmtMin = (m: number | null) =>
  m == null
    ? "00:00m"
    : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}m`;

export default function StaffGarage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [period, setPeriod] = useState<GaragePeriod>("today");
  const { stats } = useStaffGarageStats(period);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role !== "staff" && user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  const serviceDelta =
    stats.avgRepairMinutes != null ? stats.avgRepairMinutes - stats.targetMinutes : null;

  const kpis = [
    {
      label: "Bikes in the garage",
      value: String(stats.inGarage),
      change: `${stats.today} in today · ${stats.tomorrow} tomorrow`,
      trend: "neutral" as const,
      icon: Bike,
      pending: stats.inGarage > 0,
    },
    {
      label: "Bikes for repair",
      value: String(stats.forRepair),
      change: "Awaiting workshop",
      trend: "neutral" as const,
      icon: Wrench,
    },
    {
      label: "Broken / urgent",
      value: String(stats.broken),
      change: stats.broken > 0 ? "Needs priority" : "No urgent bikes",
      trend: (stats.broken > 0 ? "down" : "up") as "up" | "down",
      icon: AlertTriangle,
    },
    {
      label: "Bikes fixed",
      value: String(stats.fixed),
      change: "Completed in period",
      trend: "up" as const,
      icon: CheckCircle2,
    },
    {
      label: "Avg. repair time",
      value: fmtMin(stats.avgRepairMinutes),
      change:
        serviceDelta == null
          ? "No data yet"
          : `${serviceDelta > 0 ? "+" : ""}${serviceDelta}m vs planned`,
      trend: (serviceDelta != null && serviceDelta <= 0 ? "up" : "down") as "up" | "down",
      icon: Clock,
    },
    {
      label: "On-time delivery",
      value: stats.onTimePct == null ? "—" : `${stats.onTimePct}%`,
      change: `Target ${fmtMin(stats.targetMinutes)} per bike`,
      trend: ((stats.onTimePct ?? 0) >= 80 ? "up" : "down") as "up" | "down",
      icon: Gauge,
    },
  ];

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
              Every bike and part in the workshop — status, briefing and stock location
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border/30 bg-background/60 backdrop-blur-md p-1">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mx-2" />
            {GARAGE_PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full transition-colors",
                  period === p.id
                    ? "bg-wj-green text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </motion.div>

        <KPICarousel desktopGridClassName="md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 md:gap-4">
          {kpis.map((kpi, i) => (
            <StaffKPICard key={kpi.label} index={i} {...kpi} />
          ))}
        </KPICarousel>

        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <div className="col-span-12">
            <GarageAssistantCard className="h-[420px]" />
          </div>
          <div className="col-span-12">
            <AppointmentsTableCard title="Bikes in the workshop" className="h-[640px]" />
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  );
}