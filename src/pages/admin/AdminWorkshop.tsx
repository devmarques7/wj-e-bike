import { Fragment, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { 
  Calendar, 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Plus,
  ListChecks,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Layers,
} from "lucide-react";
import AdminDashboardLayout from "@/components/dashboard/AdminDashboardLayout";
import AdminKPICard from "@/components/dashboard/AdminKPICard";
import KPICarousel from "@/components/dashboard/KPICarousel";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSchedulingData, type AppointmentRow } from "@/hooks/scheduling/useSchedulingData";
import BookAppointmentDialog from "@/components/dashboard/scheduling/BookAppointmentDialog";
import QualityControlManagerDialog from "@/components/dashboard/scheduling/QualityControlManagerDialog";
import QualityControlPreviewCard from "@/components/dashboard/scheduling/QualityControlPreviewCard";
import ServiceTypesManagerDialog from "@/components/dashboard/scheduling/ServiceTypesManagerDialog";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import PendingRequestsCard from "@/components/dashboard/scheduling/PendingRequestsCard";
import AppointmentActionsMenu from "@/components/dashboard/scheduling/AppointmentActionsMenu";
import AppointmentCompletionDrawer from "@/components/dashboard/scheduling/AppointmentCompletionDrawer";
import AppointmentReviewHistoryDialog from "@/components/dashboard/scheduling/AppointmentReviewHistoryDialog";
import FloatingActiveAppointment from "@/components/dashboard/scheduling/FloatingActiveAppointment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const formatRelative = (
  iso: string | null,
  t: (k: string, o?: any) => string,
) => {
  if (!iso) return t("workshop.rel.no_record");
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("workshop.rel.just_now");
  if (mins < 60) return t("workshop.rel.min", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("workshop.rel.hour", { n: hrs });
  const days = Math.floor(hrs / 24);
  return t("workshop.rel.day", { n: days });
};

const formatAbsolute = (iso: string | null, locale: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale === "pt" ? "pt-PT" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusBadge = (status: string, t: (k: string) => string) => {
  // Padronização duotone monocromática:
  // verde → concluído/confirmado · amarelo → atenção · vermelho → erro · neutro → resto
  const base = "border font-normal text-[10px] gap-1 pl-1.5 pr-2 py-0.5";
  const dot = "inline-block w-1.5 h-1.5 rounded-full";
  switch (status) {
    case "completed":
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-wj-green`} /> {t("workshop.status.completed")}
        </Badge>
      );
    case "confirmed":
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-wj-green/70`} /> {t("workshop.status.confirmed")}
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-wj-green animate-pulse`} /> {t("workshop.status.in_progress")}
        </Badge>
      );
    case "pending":
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-amber-400`} /> {t("workshop.status.pending")}
        </Badge>
      );
    case "rescheduled":
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-amber-400`} /> {t("workshop.status.rescheduled")}
        </Badge>
      );
    case "canceled":
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-red-500`} /> {t("workshop.status.canceled")}
        </Badge>
      );
    case "no_show":
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-red-500/70`} /> {t("workshop.status.no_show")}
        </Badge>
      );
    default:
      return (
        <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
          <span className={`${dot} bg-muted-foreground/60`} /> {status}
        </Badge>
      );
  }
};


export default function AdminWorkshop() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("day");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "ongoing" | "completed">("all");
  const [groupBy, setGroupBy] = useState<"none" | "status" | "mechanic" | "service" | "plan">("none");
  const [sortAsc, setSortAsc] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [bookOpen, setBookOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [completionTarget, setCompletionTarget] = useState<AppointmentRow | null>(null);
  const [reviewTarget, setReviewTarget] = useState<AppointmentRow | null>(null);
  const {
    loading,
    appointments,
    serviceTypes,
    mechanics,
    updateAppointmentStatus,
    updateAppointmentFields,
    rescheduleAppointment,
    cancelAppointment,
    deleteAppointment,
    refetch,
  } = useSchedulingData();

  // Service type usage ranking (today) — must be before any early returns
  const serviceUsage = useMemo(() => {
    const counts = new Map<string, number>();
    appointments.forEach((a) => {
      if (!a.service_type_id) return;
      counts.set(a.service_type_id, (counts.get(a.service_type_id) ?? 0) + 1);
    });
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    return serviceTypes
      .map((st) => {
        const count = counts.get(st.id) ?? 0;
        return { id: st.id, name: st.name, color: st.color, count, percentage: Math.round((count / total) * 100) };
      })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [appointments, serviceTypes]);

  // Filter + sort + group
  const filteredSorted = useMemo(() => {
    const matchStatus = (s: string) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "pending") return s === "pending" || s === "confirmed" || s === "rescheduled";
      if (statusFilter === "ongoing") return s === "in_progress";
      if (statusFilter === "completed") return s === "completed";
      return true;
    };
    const arr = appointments.filter((a) => matchStatus(a.status));
    arr.sort((a, b) => {
      const cmp = a.scheduled_start_time.localeCompare(b.scheduled_start_time);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [appointments, statusFilter, sortAsc]);

  const groupedAppointments = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", items: filteredSorted }];
    const map = new Map<string, { key: string; label: string; items: AppointmentRow[] }>();
    const labelFor = (a: AppointmentRow): { key: string; label: string } => {
      switch (groupBy) {
        case "status":
          return { key: a.status, label: t(`workshop.status.${a.status}`, a.status) };
        case "mechanic":
          return { key: a.assigned_mechanic_id ?? "none", label: a.mechanic_name ?? t("workshop.cols.unassigned") };
        case "service":
          return { key: a.service_type_id ?? "none", label: a.service_name ?? t("workshop.cols.no_plan") };
        case "plan":
          return { key: a.plan_name ?? "none", label: a.plan_name ?? t("workshop.cols.no_plan") };
        default:
          return { key: "all", label: "" };
      }
    };
    for (const a of filteredSorted) {
      const { key, label } = labelFor(a);
      const g = map.get(key) ?? { key, label, items: [] };
      g.items.push(a);
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [filteredSorted, groupBy, t]);

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  const totalToday = appointments.length;
  const inProgress = appointments.filter((a) => a.status === "in_progress").length;
  const activeAppointment =
    appointments.find((a) => a.status === "in_progress" && a.work_started_at) ?? null;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const durs = appointments.filter((a) => a.duration_minutes);
  const avgDuration = durs.length
    ? durs.reduce((acc, a) => acc + (a.duration_minutes ?? 0), 0) / durs.length
    : 0;

  const workshopKPIs = [
    { label: t("workshop.kpi.today"), value: String(totalToday), change: "", trend: "up" as const, icon: Calendar },
    { label: t("workshop.kpi.in_progress"), value: String(inProgress), change: "", trend: "up" as const, icon: Wrench },
    { label: t("workshop.kpi.completed"), value: String(completed), change: "", trend: "up" as const, icon: CheckCircle2 },
    { label: t("workshop.kpi.avg_duration"), value: `${Math.round(avgDuration)}m`, change: "", trend: "up" as const, icon: Clock },
  ];

  return (
    <AdminDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-light text-foreground">{t("workshop.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("workshop.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setServicesOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 border-border/40"
            >
              <Wrench className="h-4 w-4 mr-1" />
              {t("workshop.services_btn")}
            </Button>
            <Button
              onClick={() => setQcOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 border-border/40"
            >
              <ListChecks className="h-4 w-4 mr-1" />
              {t("workshop.qc_btn")}
            </Button>
            <Button
              onClick={() => setBookOpen(true)}
              className="bg-wj-green hover:bg-wj-green/90 text-black h-9"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("workshop.new_btn")}
            </Button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <KPICarousel>
          {workshopKPIs.map((kpi, index) => (
            <AdminKPICard key={kpi.label} {...kpi} index={index} />
          ))}
        </KPICarousel>

        {/* Quality Control sequence */}
        <QualityControlPreviewCard onEdit={() => setQcOpen(true)} />

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {/* Appointments Table - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <div className="space-y-4">
              {/* Requests awaiting approval — highlighted inbox */}
              <PendingRequestsCard mechanics={mechanics} onChanged={refetch} />
              {/* Same global table (statuses, filters, auto-assign) used by staff */}
              <AppointmentsTableCard includeRequests />
            </div>
          </div>

          {/* Service usage ranking - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl p-4 h-full"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-medium text-foreground">{t("workshop.services_panel.title")}</h3>
              </div>

              {serviceUsage.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("workshop.services_panel.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {serviceUsage.map((problem, index) => (
                    <div key={problem.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-wj-green/20 text-wj-green text-[10px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs text-foreground">{problem.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{problem.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${problem.percentage}%` }}
                          transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: problem.color ?? "hsl(var(--primary))" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-border/30 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {t("workshop.services_panel.catalog")}
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="text-2xl font-light">{serviceTypes.length}</span>{" "}
                    <span className="text-xs text-muted-foreground">{t("workshop.services_panel.types_active")}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-border/40"
                  onClick={() => setServicesOpen(true)}
                >
                  <Wrench className="h-3.5 w-3.5 mr-1" />
                  {t("workshop.services_panel.manage")}
                </Button>
              </div>
            </motion.div>
          </div>
        </div>

        <BookAppointmentDialog
          open={bookOpen}
          onOpenChange={setBookOpen}
          serviceTypes={serviceTypes}
          onCreated={refetch}
        />

        <QualityControlManagerDialog open={qcOpen} onOpenChange={setQcOpen} />

        <ServiceTypesManagerDialog open={servicesOpen} onOpenChange={(v) => {
          setServicesOpen(v);
          if (!v) refetch();
        }} />

        <AppointmentCompletionDrawer
          appointment={completionTarget}
          open={!!completionTarget}
          onOpenChange={(v) => { if (!v) setCompletionTarget(null); }}
          onCompleted={() => { setCompletionTarget(null); refetch(); }}
        />

        <AppointmentReviewHistoryDialog
          appointment={reviewTarget}
          open={!!reviewTarget}
          onOpenChange={(v) => { if (!v) setReviewTarget(null); }}
        />

        <FloatingActiveAppointment
          appointment={activeAppointment}
          onOpen={() => activeAppointment && setCompletionTarget(activeAppointment)}
        />
      </div>
    </AdminDashboardLayout>
  );
}
