import { motion } from "framer-motion";
import { CreditCard, Users, CalendarCheck, Wrench, ArrowRight } from "lucide-react";
import AdminDashboardLayout from "@/components/dashboard/AdminDashboardLayout";
import AdminKPICard from "@/components/dashboard/AdminKPICard";
import KPICarousel from "@/components/dashboard/KPICarousel";
import AdminSalesRanking from "@/components/dashboard/AdminSalesRanking";
import AdminMemberSegments from "@/components/dashboard/AdminMemberSegments";
import AdminAlerts from "@/components/dashboard/AdminAlerts";
import AdminGlobalSearch from "@/components/dashboard/AdminGlobalSearch";
import AdminWorkshopStatus from "@/components/dashboard/AdminWorkshopStatus";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAdminOverviewData } from "@/hooks/admin/useAdminOverviewData";

export default function AdminOverview() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const { kpis, planRanking, workshop, alerts, totalMembers, loading } = useAdminOverviewData();

  if (isLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const fmtCur = new Intl.NumberFormat(i18n.language === "pt" ? "pt-PT" : "en-GB", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  });
  const fmtN = new Intl.NumberFormat(i18n.language === "pt" ? "pt-PT" : "en-GB");

  const pctChange = (cur: number, prev: number) => {
    if (!prev) return cur > 0 ? "+100%" : "0%";
    const v = ((cur - prev) / prev) * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  };
  const trendOf = (cur: number, prev: number): "up" | "down" =>
    cur >= prev ? "up" : "down";

  const kpiData = [
    {
      label: t("admin_overview.kpi.monthly_revenue"),
      value: fmtCur.format(kpis.monthly_revenue),
      change: pctChange(kpis.monthly_revenue, kpis.monthly_revenue_prev),
      trend: trendOf(kpis.monthly_revenue, kpis.monthly_revenue_prev),
      icon: CreditCard,
    },
    {
      label: t("admin_overview.kpi.active_members"),
      value: fmtN.format(kpis.active_members),
      change: pctChange(kpis.active_members, kpis.active_members_prev),
      trend: trendOf(kpis.active_members, kpis.active_members_prev),
      icon: Users,
    },
    {
      label: t("admin_overview.kpi.appts_today"),
      value: fmtN.format(kpis.appointments_today),
      change: t("admin_overview.kpi.completed_n", { n: kpis.appointments_today_completed }),
      trend: "up" as const,
      icon: CalendarCheck,
    },
    {
      label: t("admin_overview.kpi.workshop_load"),
      value: `${kpis.workshop_load_pct}%`,
      change: t("admin_overview.kpi.capacity_n", { n: workshop.capacity }),
      trend: (kpis.workshop_load_pct < 85 ? "up" : "down") as "up" | "down",
      icon: Wrench,
    },
  ];

  const quickActions = [
    { to: "/dashboard/admin/crm", label: t("admin_overview.quick.crm") },
    { to: "/dashboard/admin/manage", label: t("admin_overview.quick.workshop") },
    { to: "/dashboard/admin/inventory", label: t("admin_overview.quick.inventory") },
    { to: "/dashboard/admin/plans", label: t("admin_overview.quick.plans") },
  ];

  return (
    <AdminDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-light text-foreground">
              {t("admin_overview.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("admin_overview.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group flex items-center gap-2 rounded-xl border border-border/30 bg-background/60 backdrop-blur-md px-3 py-2 text-xs sm:text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                {q.label}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* KPI Cards - carousel on mobile, grid on desktop */}
        <KPICarousel>
          {kpiData.map((kpi, index) => (
            <AdminKPICard key={kpi.label} {...kpi} index={index} />
          ))}
        </KPICarousel>

        {/* Global search + System Alerts */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6 lg:h-[420px]">
          <div className="col-span-12 lg:col-span-8 min-h-0">
            <AdminGlobalSearch />
          </div>
          <div className="col-span-12 lg:col-span-4 min-h-0 overflow-hidden">
            <AdminAlerts rows={alerts} loading={loading} />
          </div>
        </div>

        {/* Main Content Grid - 12 Columns */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {/* Sales Ranking - 5 columns */}
          <div className="col-span-12 lg:col-span-5">
            <AdminSalesRanking rows={planRanking} loading={loading} />
          </div>

          {/* Middle Section - 3 columns (stacked) */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 lg:gap-6">
            <AdminMemberSegments rows={planRanking} total={totalMembers} loading={loading} />
          </div>

          {/* Workshop Status - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <AdminWorkshopStatus data={workshop} loading={loading} />
          </div>
        </div>
      </div>
    </AdminDashboardLayout>
  );
}
