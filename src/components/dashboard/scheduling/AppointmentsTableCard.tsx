import { Fragment, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Layers,
  UserPlus,
  Wand2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableHeaderBar } from "@/components/ui/table-header-bar";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchedulingData, type AppointmentRow } from "@/hooks/scheduling/useSchedulingData";
import { useAutoDispatch } from "@/hooks/scheduling/useAutoDispatch";
import {
  TASK_FILTERS,
  compareTasks,
  isTaskOverdue,
  isTodayScope,
  matchesFilter,
  taskBucket,
  taskEndsAt,
  type TaskFilter,
} from "@/lib/scheduling/taskPriority";
import { statusMeta } from "@/lib/scheduling/statusModel";
import AppointmentActionsMenu from "@/components/dashboard/scheduling/AppointmentActionsMenu";
import CustomerAppointmentActionsMenu from "@/components/dashboard/scheduling/CustomerAppointmentActionsMenu";
import AppointmentCompletionDrawer from "@/components/dashboard/scheduling/AppointmentCompletionDrawer";
import AppointmentReviewHistoryDialog from "@/components/dashboard/scheduling/AppointmentReviewHistoryDialog";
import AppointmentsEmptyState from "@/components/dashboard/scheduling/AppointmentsEmptyState";
import FloatingActiveAppointment from "@/components/dashboard/scheduling/FloatingActiveAppointment";
import { useAuth } from "@/contexts/AuthContext";

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

const formatAbsolute = (iso: string | null, locale: string) =>
  iso
    ? new Date(iso).toLocaleString(locale === "pt" ? "pt-PT" : "en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const getStatusBadge = (status: string, t: (k: string) => string) => {
  const base = "border font-normal text-[10px] gap-1 pl-1.5 pr-2 py-0.5";
  const meta = statusMeta(status);
  return (
    <Badge className={`${base} bg-muted/30 text-foreground/80 border-border/40`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {t(meta.labelKey) ?? status}
    </Badge>
  );
};

/** An appointment row that may actually be a pending scheduling REQUEST. */
type ApptRow = AppointmentRow & { isRequest?: boolean; requestStatus?: string };

const isOverdue = (a: ApptRow) => isTaskOverdue(a);

/** Whole-day distance between today and the appointment date (negative = late). */
const dayDelta = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

/** Human readable lateness ("2h 15m late") for open tasks past their window. */
const lateFor = (a: ApptRow): string | null => {
  const open = !["completed", "canceled", "no_show"].includes(a.status);
  if (!open) return null;
  const diffMin = Math.floor((Date.now() - taskEndsAt(a).getTime()) / 60000);
  if (diffMin <= 0) return null;
  const days = Math.floor(diffMin / 1440);
  const hours = Math.floor((diffMin % 1440) / 60);
  const mins = diffMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

/** Status dot colour per global filter bucket. */
const FILTER_DOT: Record<TaskFilter, string> = {
  pending: "bg-amber-400",
  requested: "bg-sky-400",
  ongoing: "bg-wj-green animate-pulse",
  unassigned: "bg-violet-400",
  overdue: "bg-orange-500",
  canceled: "bg-red-500",
  completed: "bg-wj-green",
};

interface AppointmentsTableCardProps {
  /** Hide the actions column (read-only mode for non-managers). */
  readOnly?: boolean;
  /** Optional override for the card title. */
  title?: string;
  /** Restrict the table to appointments assigned to this mechanic id. */
  mineOnlyMechanicId?: string;
  /** Customer view: scope to this user's appointments and force read-only. */
  customerUserId?: string;
  /** Also list scheduling requests (waitlist) as rows with a "requested" status. */
  includeRequests?: boolean;
  /** Scope every row to a single bike (customer garage view). */
  bikeId?: string | null;
  /** Inclusive period window; rows outside it are hidden (open jobs stay). */
  rangeFrom?: string;
  rangeTo?: string;
  /** Optional extra classes for the card root. */
  className?: string;
}

/**
 * Self-contained appointments table card used on Admin Workshop and Staff
 * Overview. Loads real data via useSchedulingData and renders the full
 * filter / group / sort / actions experience.
 */
export default function AppointmentsTableCard({
  readOnly = false,
  title,
  mineOnlyMechanicId,
  customerUserId,
  includeRequests = false,
  bikeId,
  rangeFrom,
  rangeTo,
  className,
}: AppointmentsTableCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const isCustomer = !!customerUserId;
  // Staff already get the running job inside the floating shift pill (ShiftTag).
  const showFloatingJob = !isCustomer && authUser?.role !== "staff";
  const effectiveReadOnly = readOnly || isCustomer;
  const [activeTab, setActiveTab] = useState("day");
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("pending");
  const [groupBy, setGroupBy] = useState<
    "none" | "status" | "mechanic" | "service" | "plan"
  >("none");
  const [sortAsc, setSortAsc] = useState(true);
  /** "priority" = global workshop order, "time" = plain chronological. */
  const [sortMode, setSortMode] = useState<"priority" | "time">("priority");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
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
  } = useSchedulingData({ customerUserId, bikeId, rangeFrom, rangeTo });

  /* Global dispatch role: balances today's unassigned jobs automatically and
     lets a mechanic claim whatever could not be placed. */
  const { running: dispatching, dispatch, claimTask, claimRequest, canClaim } = useAutoDispatch({
    enabled: !isCustomer,
    onChanged: refetch,
  });

  /* Scheduling requests (waitlist) — shown alongside real appointments. */
  const [requestRows, setRequestRows] = useState<ApptRow[]>([]);
  useEffect(() => {
    if (!includeRequests) {
      setRequestRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("appointment_waitlist")
        .select(
          "id, user_id, service_type_id, subscription_id, preferred_date_from, preferred_time_from, status, created_at, bike_id",
        )
        .order("created_at", { ascending: false });
      if (customerUserId) q = q.eq("user_id", customerUserId);
      if (bikeId) q = q.eq("bike_id", bikeId);
      const { data } = await q;
      if (cancelled) return;
      const rows = (data ?? []) as any[];
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const subIds = [...new Set(rows.map((r) => r.subscription_id).filter(Boolean))];

      // Resolve the same labels a real appointment shows: customer, service, plan.
      const [profRes, subRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase
              .from("subscriptions")
              .select("id, user_id, status, plan_versions(plans(name, color_hex, tier_level))")
              .in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const profMap = new Map(
        ((profRes.data ?? []) as any[]).map((p) => [p.user_id, p]),
      );
      const subById = new Map(((subRes.data ?? []) as any[]).map((s) => [s.id, s]));
      const subByUser = new Map<string, any>();
      for (const s of (subRes.data ?? []) as any[]) {
        if (!subByUser.has(s.user_id) || ["active", "trialing"].includes(s.status))
          subByUser.set(s.user_id, s);
      }
      const svcMap = new Map(serviceTypes.map((s: any) => [s.id, s]));

      setRequestRows(
        rows.map((r: any) => {
          const prof = profMap.get(r.user_id);
          const sub = (r.subscription_id && subById.get(r.subscription_id)) || subByUser.get(r.user_id);
          const plan = sub?.plan_versions?.plans ?? null;
          const svc: any = svcMap.get(r.service_type_id);
          return {
          id: r.id,
          user_id: r.user_id,
          service_type_id: r.service_type_id,
          assigned_mechanic_id: null,
          scheduled_date: r.preferred_date_from,
          scheduled_start_time: (r.preferred_time_from ?? "00:00:00") as string,
          scheduled_end_time: null,
          duration_minutes: svc?.duration_minutes ?? null,
          status: (r.status === "booked"
            ? "completed"
            : r.status === "expired"
              ? "canceled"
              : "requested") as any,
          priority: "normal",
          priority_score: 0,
          customer_name: prof?.full_name ?? prof?.email ?? null,
          customer_email: prof?.email ?? null,
          mechanic_name: null,
          service_name: svc?.name ?? null,
          service_color: svc?.color ?? null,
          plan_name: plan?.name ?? null,
          plan_color: plan?.color_hex ?? null,
          plan_tier: plan?.tier_level ?? null,
          updated_at: r.created_at,
          work_started_at: null,
          work_ended_at: null,
          isRequest: true,
          requestStatus: r.status,
          } as ApptRow;
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [includeRequests, customerUserId, bikeId, appointments.length, serviceTypes]);

  const activeAppointment =
    appointments.find((a) => a.status === "in_progress" && a.work_started_at) ?? null;

  /** Rows in scope for this surface, before the status filter is applied. */
  const scopedRows = useMemo(
    () =>
      ([...appointments, ...requestRows] as ApptRow[])
        .filter((a) =>
          mineOnlyMechanicId
            ? a.assigned_mechanic_id === mineOnlyMechanicId || !a.assigned_mechanic_id
            : true,
        )
        .filter((a) => {
          if (isCustomer) return true;
          if (rangeFrom && rangeTo) {
            const inRange = a.scheduled_date >= rangeFrom && a.scheduled_date <= rangeTo;
            // Never lose running or late work, whatever the selected window is.
            const bucket = taskBucket(a);
            return inRange || bucket === "ongoing" || bucket === "overdue";
          }
          return isTodayScope(a);
        }),
    [appointments, requestRows, mineOnlyMechanicId, isCustomer, rangeFrom, rangeTo],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(TASK_FILTERS.map((f) => [f, 0])) as Record<TaskFilter, number>;
    for (const a of scopedRows) {
      for (const f of TASK_FILTERS) if (matchesFilter(a, f)) c[f] += 1;
    }
    return c;
  }, [scopedRows]);

  const filteredSorted = useMemo(() => {
    const arr = scopedRows.filter((a) => matchesFilter(a, statusFilter));
    arr.sort((a, b) => {
      if (sortMode === "priority") return compareTasks(a, b);
      const cmp =
        a.scheduled_date.localeCompare(b.scheduled_date) ||
        a.scheduled_start_time.localeCompare(b.scheduled_start_time);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [scopedRows, statusFilter, sortAsc, sortMode]);

  /* Pagination: at most 5 rows per page; the viewport shows ~3 and scrolls. */
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);
  useEffect(() => {
    setPage(0);
  }, [statusFilter, groupBy, sortAsc, sortMode, rangeFrom, rangeTo]);
  const pagedRows = useMemo(
    () => filteredSorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filteredSorted, page],
  );

  const groupedAppointments = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", items: pagedRows }];
    const map = new Map<string, { key: string; label: string; items: ApptRow[] }>();
    const labelFor = (a: ApptRow): { key: string; label: string } => {
      switch (groupBy) {
        case "status":
          return { key: taskBucket(a), label: t(`workshop.appts.${taskBucket(a)}`) };
        case "mechanic":
          return {
            key: a.assigned_mechanic_id ?? "none",
            label: a.mechanic_name ?? t("workshop.cols.unassigned"),
          };
        case "service":
          return {
            key: a.service_type_id ?? "none",
            label: a.service_name ?? t("workshop.cols.no_plan"),
          };
        case "plan":
          return { key: a.plan_name ?? "none", label: a.plan_name ?? t("workshop.cols.no_plan") };
        default:
          return { key: "all", label: "" };
      }
    };
    for (const a of pagedRows) {
      const { key, label } = labelFor(a);
      const g = map.get(key) ?? { key, label, items: [] };
      g.items.push(a);
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [pagedRows, groupBy, t]);

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cn("w-full bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl overflow-hidden min-h-[420px] h-full flex flex-col", className)}
      >
        <TableHeaderBar
          title={title ?? t("workshop.appts.title")}
          primary={
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="day" className="text-xs">{t("workshop.appts.day")}</TabsTrigger>
                <TabsTrigger value="week" className="text-xs" disabled>{t("workshop.appts.week")}</TabsTrigger>
                <TabsTrigger value="month" className="text-xs" disabled>{t("workshop.appts.month")}</TabsTrigger>
              </TabsList>
            </Tabs>
          }
          filters={
            <Tabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TaskFilter)}
            >
              <TabsList className="bg-muted/40 h-8 w-max">
                {TASK_FILTERS.filter((f) => !(isCustomer && f === "unassigned")).map((f) => (
                  <TabsTrigger
                    key={f}
                    value={f}
                    className="text-[11px] h-6 px-2.5 whitespace-nowrap"
                  >
                    <span
                      className={cn(
                        "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                        FILTER_DOT[f],
                      )}
                    />
                    {t(`workshop.appts.${f}`)}
                    {counts[f] > 0 && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                        {counts[f]}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
          controls={
            <>
              {!isCustomer && canClaim && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px] border-border/40 gap-1.5 whitespace-nowrap"
                  disabled={dispatching}
                  onClick={() => dispatch()}
                >
                  {dispatching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  {t("workshop.appts.auto_dispatch")}
                </Button>
              )}
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px] sm:flex-none">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                  <SelectTrigger className="h-8 text-[11px] border-border/40 w-full sm:w-[150px]">
                    <SelectValue placeholder={t("workshop.appts.group_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">{t("workshop.appts.group_none")}</SelectItem>
                    <SelectItem value="status" className="text-xs">{t("workshop.appts.group_status")}</SelectItem>
                    <SelectItem value="mechanic" className="text-xs">{t("workshop.appts.group_mechanic")}</SelectItem>
                    <SelectItem value="service" className="text-xs">{t("workshop.appts.group_service")}</SelectItem>
                    <SelectItem value="plan" className="text-xs">{t("workshop.appts.group_plan")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[11px] border-border/40 gap-1.5 whitespace-nowrap"
                onClick={() => {
                  if (sortMode === "priority") {
                    setSortMode("time");
                    setSortAsc(true);
                  } else if (sortAsc) {
                    setSortAsc(false);
                  } else {
                    setSortMode("priority");
                  }
                }}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortMode === "priority"
                  ? t("workshop.appts.sort_priority")
                  : `${t("workshop.appts.sort_time")} ${sortAsc ? "↑" : "↓"}`}
              </Button>
            </>
          }
        />

        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("workshop.appts.loading")}
            </div>
          ) : filteredSorted.length === 0 ? (
            <AppointmentsEmptyState
              hideCta={effectiveReadOnly && !isCustomer}
              onCreate={() =>
                navigate(
                  isCustomer
                    ? "/dashboard/garage"
                    : "/dashboard/staff/schedule",
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium w-[80px]">{t("workshop.cols.time")}</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">{t("workshop.cols.customer")}</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">{t("workshop.cols.plan")}</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">{t("workshop.cols.service")}</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                    {isCustomer
                      ? t("workshop.cols.countdown", "Days left")
                      : t("workshop.cols.mechanic")}
                  </TableHead>
                  {!isCustomer && (
                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium w-[90px]">
                      {t("workshop.cols.late", { defaultValue: "Late" })}
                    </TableHead>
                  )}
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">{t("workshop.cols.status")}</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium text-right w-[80px]">
                    {t("workshop.cols.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedAppointments.map((group) => (
                  <Fragment key={`g-${group.key}`}>
                    {groupBy !== "none" && (
                      <TableRow
                        className="border-border/30 bg-muted/20 hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleGroup(group.key)}
                      >
                        <TableCell colSpan={isCustomer ? 7 : 8} className="py-2">
                          <div className="flex items-center gap-2 text-xs">
                            {collapsedGroups[group.key] ? (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="font-medium text-foreground">{group.label}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {group.items.length}{" "}
                              {group.items.length === 1
                                ? t("workshop.appts.item_one")
                                : t("workshop.appts.item_other")}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {!collapsedGroups[group.key] &&
                      group.items.map((apt) => (
                        <TableRow
                          key={apt.id}
                          className={`border-border/20 transition-all duration-300 hover:bg-wj-green/10 hover:text-foreground hover:shadow-[inset_2px_0_0_0_hsl(var(--wj-green)/0.6)] cursor-pointer`}
                          onClick={async () => {
                            /* Completed → the ONLY case that opens Review
                               History (assessment, notes, photos, billing). */
                            if (!apt.isRequest && apt.status === "completed") {
                              setReviewTarget(apt);
                              return;
                            }
                            /* Staff/admin on a live or scheduled job → open the
                               Quality Control drawer to run/finish the service.
                               Pending/confirmed jobs are started first (clock-in
                               + in_progress) so the QC flow begins at stage 0. */
                            if (!apt.isRequest && !isCustomer) {
                              if (apt.status === "in_progress") {
                                setCompletionTarget(apt);
                                return;
                              }
                              if (apt.status === "pending" || apt.status === "confirmed") {
                                const ok = await updateAppointmentStatus(apt.id, "in_progress");
                                if (ok) setCompletionTarget({ ...apt, status: "in_progress" } as any);
                                return;
                              }
                            }
                            /* Otherwise → jump to the bike's E-Pass detail page
                               (same destination as the QR scan flow). */
                            const bike = (apt as any).bike_id as string | null | undefined;
                            if (bike) {
                              navigate(
                                isCustomer
                                  ? `/dashboard/garage/bike/${bike}`
                                  : `/dashboard/staff/garage/bike/${bike}`,
                              );
                              return;
                            }
                          }}
                        >
                          <TableCell className="text-xs font-medium align-middle">
                            <div className="flex items-center gap-1.5">
                              <span className="tabular-nums">{apt.scheduled_start_time.slice(0, 5)}</span>
                              {apt.priority === "vip" && (
                                <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/15 text-amber-400 border-amber-500/30">VIP</Badge>
                              )}
                              {apt.priority === "emergency" && (
                                <Badge className="text-[9px] h-4 px-1.5 bg-red-500/15 text-red-400 border-red-500/30">SOS</Badge>
                              )}
                            </div>
                            {isCustomer && (
                              <span className="block text-[10px] text-muted-foreground/70 tabular-nums">
                                {new Date(apt.scheduled_date).toLocaleDateString(
                                  i18n.language === "pt" ? "pt-PT" : "en-GB",
                                  { day: "2-digit", month: "short" },
                                )}
                              </span>
                            )}
                            {apt.duration_minutes ? (
                              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                                {apt.duration_minutes}
                                {t("workshop.cols.min")}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs align-middle">
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-8 w-8 border border-border/30 cursor-default">
                                    <AvatarFallback className="text-[10px] bg-muted/50">
                                      {(apt.customer_name ?? apt.customer_email ?? "?")
                                        .split(" ")
                                        .map((s) => s[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <div className="font-medium">{apt.customer_name ?? "—"}</div>
                                  {apt.customer_email && (
                                    <div className="text-muted-foreground text-[10px]">
                                      {apt.customer_email}
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="align-middle">
                            {apt.plan_name ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                                style={{
                                  color: apt.plan_color ?? "#9ca3af",
                                  borderColor: `${apt.plan_color ?? "#9ca3af"}40`,
                                  backgroundColor: `${apt.plan_color ?? "#9ca3af"}15`,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: apt.plan_color ?? "#9ca3af" }}
                                />
                                {apt.plan_name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60">
                                {t("workshop.cols.no_plan")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs align-middle">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-1.5 h-6 rounded-full shrink-0"
                                style={{ backgroundColor: apt.service_color ?? "#9ca3af" }}
                              />
                              <span className="truncate">{apt.service_name ?? "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground align-middle">
                            {isCustomer ? (
                              (() => {
                                const terminal =
                                  apt.status === "completed" ||
                                  apt.status === "canceled" ||
                                  apt.status === "no_show";
                                if (terminal) return <span className="text-muted-foreground/50">—</span>;
                                const delta = dayDelta(apt.scheduled_date);
                                const late = delta < 0 || isOverdue(apt);
                                const lateDays = Math.max(0, -delta);
                                return (
                                  <div className="flex flex-col items-start gap-1">
                                    <span
                                      className={cn(
                                        "tabular-nums text-xs font-medium",
                                        late ? "text-orange-500" : "text-foreground",
                                      )}
                                    >
                                      {late
                                        ? lateDays > 0
                                          ? t("workshop.cols.days_late", {
                                              n: lateDays,
                                              defaultValue: "{{n}} d late",
                                            })
                                          : t("workshop.cols.late_today", { defaultValue: "Late today" })
                                        : delta === 0
                                          ? t("workshop.cols.today", { defaultValue: "Today" })
                                          : t("workshop.cols.in_days", {
                                              n: delta,
                                              defaultValue: "in {{n}} d",
                                            })}
                                    </span>
                                    {late && (
                                      <CustomerAppointmentActionsMenu
                                        appointment={apt}
                                        variant="reschedule"
                                        onViewDetails={() => setReviewTarget(apt)}
                                        onReschedule={rescheduleAppointment}
                                        onCancel={cancelAppointment}
                                      />
                                    )}
                                  </div>
                                );
                              })()
                            ) : apt.mechanic_name ? (
                              apt.mechanic_name
                            ) : canClaim && !effectiveReadOnly && apt.status !== "completed" && apt.status !== "canceled" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] gap-1 border-wj-green/40 text-wj-green hover:bg-wj-green/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (apt.isRequest) {
                                    void claimRequest({
                                      id: apt.id,
                                      user_id: apt.user_id,
                                      service_type_id: apt.service_type_id,
                                      scheduled_date: apt.scheduled_date,
                                      scheduled_start_time: apt.scheduled_start_time,
                                      duration_minutes: apt.duration_minutes,
                                    });
                                    return;
                                  }
                                  void claimTask({
                                    id: apt.id,
                                    scheduled_date: apt.scheduled_date,
                                    scheduled_start_time: apt.scheduled_start_time,
                                    duration_minutes: apt.duration_minutes,
                                    assigned_mechanic_id: null,
                                    status: apt.status as string,
                                  });
                                }}
                              >
                                <UserPlus className="h-3 w-3" />
                                {t("workshop.appts.assign_me")}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground/60 italic">
                                {t("workshop.cols.unassigned")}
                              </span>
                            )}
                          </TableCell>
                          {!isCustomer && (
                            <TableCell className="align-middle text-xs">
                              {(() => {
                                const late = lateFor(apt);
                                if (!late)
                                  return <span className="text-muted-foreground/40">—</span>;
                                return (
                                  <span className="tabular-nums font-medium text-orange-500">
                                    {late} {t("workshop.cols.late_suffix", { defaultValue: "late" })}
                                  </span>
                                );
                              })()}
                            </TableCell>
                          )}
                          <TableCell className="align-middle">
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-default">
                                    {getStatusBadge(
                                      isOverdue(apt) ? "overdue" : (apt.status as string),
                                      t,
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    <span className="font-medium">{formatRelative(apt.updated_at, t)}</span>
                                  </div>
                                  <div className="text-muted-foreground text-[10px]">
                                    {t("workshop.status_tip.last_change")}:{" "}
                                    {formatAbsolute(apt.updated_at, i18n.language)}
                                  </div>
                                  {apt.work_started_at && (
                                    <div className="text-muted-foreground text-[10px]">
                                      {t("workshop.status_tip.started")}:{" "}
                                      {formatAbsolute(apt.work_started_at, i18n.language)}
                                    </div>
                                  )}
                                  {apt.work_ended_at && (
                                    <div className="text-muted-foreground text-[10px]">
                                      {t("workshop.status_tip.ended")}:{" "}
                                      {formatAbsolute(apt.work_ended_at, i18n.language)}
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          {!effectiveReadOnly ? (
                            <TableCell
                              className="text-right align-middle"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AppointmentActionsMenu
                                appointment={apt}
                                mechanics={mechanics}
                                serviceTypes={serviceTypes}
                                onStart={() => updateAppointmentStatus(apt.id, "in_progress")}
                                onComplete={() => setCompletionTarget(apt)}
                                onReviewHistory={() => setReviewTarget(apt)}
                                onExtendTime={async (extra) => {
                                  const newDuration = (apt.duration_minutes ?? 0) + extra;
                                  await updateAppointmentFields(apt.id, {
                                    duration_minutes: newDuration,
                                  });
                                  toast.warning(t("workshop.actions.extra_added", { n: extra }));
                                }}
                                onUpdateFields={updateAppointmentFields}
                                onReschedule={rescheduleAppointment}
                                onCancel={cancelAppointment}
                                onDelete={deleteAppointment}
                              />
                            </TableCell>
                          ) : (
                            <TableCell
                              className="text-right align-middle"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CustomerAppointmentActionsMenu
                                appointment={apt}
                                onViewDetails={() => setReviewTarget(apt)}
                                onReschedule={rescheduleAppointment}
                                onCancel={cancelAppointment}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {!loading && filteredSorted.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border/30">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredSorted.length)} /{" "}
              {filteredSorted.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] border-border/40"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {page + 1}/{totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] border-border/40"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      <AppointmentCompletionDrawer
        appointment={completionTarget}
        open={!!completionTarget}
        onOpenChange={(v) => {
          if (!v) setCompletionTarget(null);
        }}
        onCompleted={() => {
          setCompletionTarget(null);
          refetch();
        }}
      />

      <AppointmentReviewHistoryDialog
        appointment={reviewTarget}
        open={!!reviewTarget}
        onOpenChange={(v) => {
          if (!v) setReviewTarget(null);
        }}
      />

      {showFloatingJob && (
        <FloatingActiveAppointment
          appointment={activeAppointment}
          onOpen={() => activeAppointment && setCompletionTarget(activeAppointment)}
        />
      )}
    </>
  );
}