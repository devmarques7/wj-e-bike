import { useState } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { Bike, Wrench, AlertTriangle, CheckCircle2, Clock, Gauge, CalendarDays } from "lucide-react";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import StaffKPICard from "@/components/dashboard/StaffKPICard";
import KPICarousel from "@/components/dashboard/KPICarousel";
import GarageAssistantCard from "@/components/dashboard/garage/GarageAssistantCard";
import CatalogSearchCard from "@/components/dashboard/garage/CatalogSearchCard";
import RecentEPassCard from "@/components/dashboard/garage/RecentEPassCard";
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
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const { stats } = useStaffGarageStats(period, myTasksOnly ? user?.id : undefined);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role !== "staff" && user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  const initials = (user?.name || user?.email || "ME")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  const serviceDelta =
    stats.avgRepairMinutes != null ? stats.avgRepairMinutes - stats.targetMinutes : null;

  const kpis = [
    {
      label: "Bikes in the garage",
      value: String(stats.inGarage),
      change: `${stats.today} in today · ${stats.tomorrow} tomorrow`,
      trend: "neutral" as const,
      icon: Bike,
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
          <div className="flex items-center gap-2 flex-wrap">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setMyTasksOnly((v) => !v)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-medium tracking-wide transition-all",
                      myTasksOnly
                        ? "border-wj-green/60 bg-wj-green text-white shadow-[0_0_0_3px_hsl(var(--wj-green)/0.18)]"
                        : "border-border/30 bg-background/60 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-wj-green/40",
                    )}
                    aria-pressed={myTasksOnly}
                  >
                    {initials || "ME"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Show only tasks assigned to me or unassigned tasks I can pick up.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
          </div>
        </motion.div>

        <KPICarousel desktopGridClassName="md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 md:gap-4">
          {kpis.map((kpi, i) => (
            <StaffKPICard key={kpi.label} index={i} {...kpi} />
          ))}
        </KPICarousel>

        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <div className="col-span-12">
            <RecentEPassCard />
          </div>
          <div className="col-span-12 lg:col-span-7">
            <GarageAssistantCard className="h-[520px]" />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <CatalogSearchCard className="h-[520px]" />
          </div>
          <div className="col-span-12">
            <AppointmentsTableCard
              title="Bikes in the workshop"
              mineOnlyMechanicId={myTasksOnly ? user?.id : undefined}
            />
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  );
}