import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  CalendarOff,
  ChevronRight,
  ChevronLeft,
  Activity,
  CalendarDays,
  LayoutGrid,
  CheckCircle2,
  Wrench,
  TrendingUp,
  Settings,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MeshGradient } from "@paper-design/shaders-react";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import StaffKPICard from "@/components/dashboard/StaffKPICard";
import KPICarousel from "@/components/dashboard/KPICarousel";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSchedulingData } from "@/hooks/scheduling/useSchedulingData";
import StaffScheduleDialog from "@/components/dashboard/scheduling/StaffScheduleDialog";
import TeamWeekWorkloadCompact from "@/components/dashboard/scheduling/TeamWeekWorkloadCompact";
import MyShiftWeekCompact from "@/components/dashboard/scheduling/MyShiftWeekCompact";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSchedulingAvailability } from "@/contexts/SchedulingAvailabilityContext";
import { dateKey } from "@/lib/scheduling/availabilityGuard";
import { localYmd } from "@/lib/scheduling/localDate";
import { useStaffWeekWorkload } from "@/hooks/staff/useStaffWeekWorkload";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAYS_HEAT_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const getHeatColor = (v: number) => {
  if (v === 0) return "bg-muted/30";
  if (v === 1) return "bg-wj-green/20";
  if (v === 2) return "bg-wj-green/40";
  if (v === 3) return "bg-wj-green/60";
  if (v === 4) return "bg-wj-green/80";
  return "bg-wj-green";
};

export default function StaffSchedule() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language?.startsWith("pt") ? "pt-PT" : "en-GB";
  const getHeatLabel = (v: number) => {
    if (v === 0) return t("manage.heatmap.labels.none");
    if (v === 1) return t("manage.heatmap.labels.light");
    if (v <= 2) return t("manage.heatmap.labels.moderate");
    if (v <= 4) return t("manage.heatmap.labels.busy");
    return t("manage.heatmap.labels.very_busy");
  };

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [mySchedOpen, setMySchedOpen] = useState(false);
  const [heatMonth, setHeatMonth] = useState(new Date().getMonth());
  const [heatYear, setHeatYear] = useState(new Date().getFullYear());
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({});
  const [weeklySchedule, setWeeklySchedule] = useState<
    { day_of_week: number; is_working: boolean; start_time: string | null; end_time: string | null }[]
  >([]);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const { ensureAvailability } = useSchedulingAvailability();

  /**
   * Selecting a future day with no availability offers to open it, so the
   * workload of that day becomes bookable for the whole workshop.
   */
  const handleDaySelect = async (date: Date) => {
    setSelectedDate(date);
    if (!user?.id) return;
    const key = dateKey(date);
    if (key < dateKey(new Date())) return;
    const opened = await ensureAvailability(user.id, key);
    if (opened) setScheduleVersion((v) => v + 1);
  };

  const shaderColors = theme === "dark"
    ? ["#0a0a0a", "#0d2818", "#058c42", "#10b981", "#022c1a"]
    : ["#f5f7f5", "#dff5e8", "#058c42", "#86efac", "#ecfdf5"];

  const dateStr = localYmd(selectedDate ?? new Date());
  const {
    loading,
    exceptions,
    mechanics,
    appointments,
  } = useSchedulingData({ date: dateStr });

  const mineUserId = user?.id ?? "";
  const me = useMemo(
    () => mechanics.find((m) => m.user_id === mineUserId) ?? null,
    [mechanics, mineUserId],
  );

  /**
   * Weekly truth for this mechanic: booked minutes vs. real capacity from
   * staff_schedules, refreshed live through the global appointments bus.
   * The page-level `appointments` list only holds the selected day, so every
   * "this week" figure has to come from here.
   */
  const { totals: week } = useStaffWeekWorkload(mineUserId || undefined);

  // Load my working hours (staff_schedules) to derive real weekly availability
  useEffect(() => {
    if (!mineUserId) return;
    const today = localYmd(new Date());
    (async () => {
      const { data, error } = await supabase
        .from("staff_schedules")
        .select("day_of_week, is_working, start_time, end_time")
        .eq("staff_id", mineUserId)
        .lte("valid_from", today)
        .or(`valid_until.is.null,valid_until.gte.${today}`);
      if (error) return;
      setWeeklySchedule((data ?? []) as any);
    })();
  }, [mineUserId, scheduleVersion]);

  // Personal monthly heatmap (own appointments only)
  useEffect(() => {
    if (!mineUserId) return;
    const from = `${heatYear}-${String(heatMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(heatYear, heatMonth + 1, 0).getDate();
    const to = `${heatYear}-${String(heatMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    (async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("scheduled_date")
        .eq("assigned_mechanic_id", mineUserId)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .in("status", ["pending", "confirmed", "in_progress", "completed"]);
      if (error) return;
      const map: Record<string, number> = {};
      (data ?? []).forEach((a: any) => {
        map[a.scheduled_date] = (map[a.scheduled_date] ?? 0) + 1;
      });
      setMonthCounts(map);
    })();
  }, [heatMonth, heatYear, mineUserId, appointments.length]);

  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role !== "staff") return <Navigate to="/dashboard" replace />;

  // --- Scoped to me only ---
  const mineAppts = appointments.filter((a) => a.assigned_mechanic_id === mineUserId);
  const dayList = mineAppts.filter((a) => a.scheduled_date === dateStr);

  // --- Weekly availability from my working hours ---
  const parseHM = (t: string | null) => {
    if (!t) return 0;
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    return (h ?? 0) + (m ?? 0) / 60;
  };
  const availableHoursPerDay: Record<number, number> = {};
  weeklySchedule.forEach((r) => {
    if (!r.is_working) return;
    const hrs = Math.max(0, parseHM(r.end_time) - parseHM(r.start_time));
    availableHoursPerDay[r.day_of_week] = hrs;
  });
  const weeklyAvailableHours = Math.round(
    Object.values(availableHoursPerDay).reduce((a, b) => a + b, 0),
  );
  const workingDays = Object.values(availableHoursPerDay).filter((h) => h > 0).length;

  /* Every weekly figure below is fed by the live week hook so the page stays
     in sync with any booking made by customers, admins or the assistant. */
  const weeklyAppointments = week.jobs;
  const weeklyCapacity =
    week.capacityMinutes > 0
      ? Math.round(week.capacityMinutes / 60)
      : weeklyAvailableHours > 0
        ? weeklyAvailableHours
        : (me?.weekly_capacity ?? 40);
  const weeklyUsedHours = week.bookedMinutes / 60;
  const workloadPercentage = week.pct;
  const isFullWeek = week.isFull;
  const completed = week.completed;
  const inProgress = week.inProgress;
  const weeklyHours = Math.round(week.workedMinutes / 60);
  const avgDuration = week.avgDurationMinutes;

  const kpiData = [
    {
      label: "My Appointments",
      value: String(weeklyAppointments),
      change: `${weeklyAppointments} this week`,
      trend: "neutral" as const,
      icon: CalendarDays,
    },
    {
      label: "Weekly Hours",
      value: `${weeklyHours}h`,
      change: `of ${weeklyCapacity}h available`,
      trend: weeklyCapacity > 0 && weeklyHours >= weeklyCapacity * 0.8 ? ("up" as const) : ("neutral" as const),
      icon: Clock,
    },
    {
      label: "Completed",
      value: String(completed),
      change: inProgress > 0 ? `${inProgress} in progress` : "no active task",
      trend: "up" as const,
      icon: CheckCircle2,
    },
    {
      label: "My Workload",
      value: `${workloadPercentage}%`,
      change:
        isFullWeek
          ? "week full"
          : workloadPercentage > 80
          ? "very busy"
          : workloadPercentage > 60
            ? "balanced"
            : "light load",
      trend: workloadPercentage > 80 ? ("down" as const) : ("up" as const),
      icon: Activity,
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
          className="flex items-start sm:items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-wj-green shrink-0" />
              <h1 className="text-xl sm:text-2xl font-light text-foreground">Manage</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              My personal schedule, workload and weekly distribution
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMySchedOpen(true)}
            className="gap-2 shrink-0"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">My Working Hours</span>
          </Button>
        </motion.div>

        {/* KPI Row - carousel on mobile, grid on desktop */}
        <KPICarousel>
          {kpiData.map((kpi, index) => (
            <StaffKPICard key={kpi.label} {...kpi} index={index} />
          ))}
        </KPICarousel>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-4 lg:gap-5">
          {/* Row 1 — My Workload bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="col-span-12 lg:col-span-8 p-4 lg:p-5 flex flex-col bg-background/60 backdrop-blur-md border border-border/30 rounded-3xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-wj-green" />
                <h3 className="text-sm font-medium text-foreground">My Workload</h3>
              </div>
              <Badge
                className={cn(
                  "text-[10px]",
                  isFullWeek || workloadPercentage > 80
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : workloadPercentage > 60
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-wj-green/20 text-wj-green border-wj-green/30",
                )}
              >
                {isFullWeek ? `Full · ${workloadPercentage}%` : `${workloadPercentage}% of capacity`}
              </Badge>
            </div>

            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${workloadPercentage}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className={cn(
                  "h-full rounded-full",
                  workloadPercentage > 80
                    ? "bg-gradient-to-r from-red-500 to-red-400"
                    : workloadPercentage > 60
                      ? "bg-gradient-to-r from-amber-500 to-amber-400"
                      : "bg-gradient-to-r from-wj-green to-wj-green/60",
                )}
              />
            </div>

            <div className="flex justify-between mt-2 text-[11px] text-muted-foreground">
              <span>
                {Math.round(weeklyUsedHours * 10) / 10}h used · {weeklyAppointments} appointments
              </span>
              <span>
                {isFullWeek
                  ? "no capacity left this week"
                  : `${Math.max(0, Math.round((weeklyCapacity - weeklyUsedHours) * 10) / 10)}h free of ${weeklyCapacity}h`}
              </span>
            </div>
          </motion.div>

          {/* Today's Progress */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="col-span-12 lg:col-span-4 p-4 lg:p-5 rounded-3xl border border-border/30 backdrop-blur-md bg-background/60 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-wj-green" />
              <h3 className="text-sm font-medium text-foreground">Today's Progress</h3>
              <Badge variant="outline" className="ml-auto text-[10px] border-border/40">
                {dayList.filter((a) => a.status === "completed").length}/{dayList.length}
              </Badge>
            </div>
            <TodayProgressList
              appointments={dayList}
              onChanged={() => setScheduleVersion((v) => v + 1)}
            />
          </motion.div>

          {/* Row 2 — My Weekly Schedule (reusing team week with [me]) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="col-span-12 lg:col-span-8 lg:min-h-[340px] p-3 lg:p-4 bg-background/60 backdrop-blur-md border border-border/30 rounded-3xl flex flex-col"
          >
            <Tabs defaultValue="appointments" className="flex-1 flex flex-col min-h-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-foreground">My Weekly Schedule</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Distribution of personal appointments and shift fulfillment
                  </p>
                </div>
                <TabsList className="h-8 bg-muted/40 border border-border/30">
                  <TabsTrigger value="appointments" className="text-[11px] px-3 h-6">
                    Appointments
                  </TabsTrigger>
                  <TabsTrigger value="shifts" className="text-[11px] px-3 h-6">
                    Shifts
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="appointments" className="flex-1 min-h-0 mt-0">
                {me ? (
                  <TeamWeekWorkloadCompact mechanics={[me]} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Your mechanic profile is not configured yet.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="shifts" className="flex-1 min-h-0 mt-0">
                {mineUserId ? (
                  <MyShiftWeekCompact
                    userId={mineUserId}
                    displayName={me?.full_name ?? me?.email ?? user?.email ?? "Me"}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Sign in to track your shifts.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* My profile card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative col-span-12 lg:col-span-4 lg:min-h-[340px] rounded-3xl overflow-hidden bg-background border border-border/30 flex flex-col"
          >
            <MeshGradient
              colors={shaderColors}
              speed={0.25}
              distortion={1}
              swirl={0.8}
              className="absolute inset-0 w-full h-full"
              style={{ opacity: theme === "dark" ? 0.85 : 0.7 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-background/10 dark:from-background/80 dark:via-background/30 dark:to-transparent" />

            <div className="relative z-10 p-3 lg:p-4 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-wj-green" />
                <h3 className="text-sm font-medium text-foreground">My Profile</h3>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : !me ? (
                <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground">
                  No mechanic record found for your account.
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/30">
                    <div className="w-10 h-10 rounded-full bg-wj-green/20 text-wj-green text-xs font-bold flex items-center justify-center">
                      {(me.full_name ?? me.email ?? "??")
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {me.full_name ?? me.email}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{me.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {weeklyAppointments}/{weeklyCapacity}h
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 p-2.5 rounded-xl bg-wj-green/10 border border-wj-green/20">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Availability this week
                      </p>
                      <p className="text-base font-light text-foreground mt-0.5">
                        {weeklyAvailableHours}h
                        <span className="text-[10px] text-muted-foreground ml-1">
                          · {workingDays} day{workingDays === 1 ? "" : "s"}
                        </span>
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Avg. Time
                      </p>
                      <p className="text-base font-light text-foreground mt-0.5">{avgDuration}m</p>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Completed
                      </p>
                      <p className="text-base font-light text-foreground mt-0.5">{completed}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        In progress
                      </p>
                      <p className="text-base font-light text-foreground mt-0.5">{inProgress}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Hours
                      </p>
                      <p className="text-base font-light text-foreground mt-0.5">{weeklyHours}h</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Row 3 — Personal Heatmap (own appointments) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="col-span-12 lg:col-span-4 p-4 lg:p-5 bg-background/60 backdrop-blur-md border border-border/30 rounded-3xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="h-4 w-4 text-wj-green" />
              <h3 className="text-sm font-medium text-foreground">My Workload Calendar</h3>
            </div>
            <TooltipProvider>
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (heatMonth === 0) {
                      setHeatMonth(11);
                      setHeatYear((y) => y - 1);
                    } else setHeatMonth((m) => m - 1);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium text-foreground capitalize">
                  {new Date(heatYear, heatMonth).toLocaleDateString(locale, {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (heatMonth === 11) {
                      setHeatMonth(0);
                      setHeatYear((y) => y + 1);
                    } else setHeatMonth((m) => m + 1);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS_HEAT_KEYS.map((k, i) => (
                  <div
                    key={i}
                    className="text-center text-[9px] text-muted-foreground uppercase"
                  >
                    {t(`manage.days_short.${k}`).charAt(0)}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const first = new Date(heatYear, heatMonth, 1);
                  const last = new Date(heatYear, heatMonth + 1, 0);
                  const pad = first.getDay();
                  const cells: JSX.Element[] = [];
                  for (let i = 0; i < pad; i++) {
                    cells.push(<div key={`p-${i}`} className="aspect-square" />);
                  }
                  for (let day = 1; day <= last.getDate(); day++) {
                    const date = new Date(heatYear, heatMonth, day);
                    const key = `${heatYear}-${String(heatMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const count = monthCounts[key] ?? 0;
                    const dow = date.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isSelected =
                      selectedDate && date.toDateString() === selectedDate.toDateString();
                    cells.push(
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleDaySelect(date)}
                            className={cn(
                              "aspect-square rounded-md flex items-center justify-center text-[10px] transition-all hover:ring-1 hover:ring-wj-green/50",
                              isWeekend && !count && "opacity-40",
                              isToday && "ring-1 ring-wj-green",
                              isSelected && "ring-2 ring-wj-green",
                              getHeatColor(count),
                            )}
                          >
                            {day}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">
                            {date.toLocaleDateString(locale, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <p className="text-muted-foreground">
                            {t("manage.heatmap.appointments", { n: count })} ·{" "}
                            {getHeatLabel(count)}
                          </p>
                        </TooltipContent>
                      </Tooltip>,
                    );
                  }
                  return cells;
                })()}
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{t("manage.heatmap.less")}</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3, 4, 5].map((l) => (
                    <div key={l} className={cn("w-3 h-3 rounded-sm", getHeatColor(l))} />
                  ))}
                </div>
                <span>{t("manage.heatmap.more")}</span>
              </div>
            </TooltipProvider>

            <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate">
                {selectedDate?.toLocaleDateString(locale, { day: "numeric", month: "short" })}
              </span>
              <span className="text-foreground font-medium">
                {dayList.length} {t("manage.heatmap.appointments", { n: dayList.length })}
              </span>
            </div>
          </motion.div>

          {/* Exceptions (read-only) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-12 lg:col-span-8 p-3 lg:p-4 bg-background/60 backdrop-blur-md border border-border/30 rounded-3xl flex flex-col min-h-0"
          >
            <div className="flex items-center gap-2 mb-3">
              <CalendarOff className="h-4 w-4 text-wj-green" />
              <h3 className="text-sm font-medium text-foreground">Workshop Exceptions</h3>
              <Badge variant="outline" className="ml-auto text-[10px] border-border/40">
                read-only
              </Badge>
            </div>
            {exceptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming exceptions.</p>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto min-h-0 pr-1">
                {exceptions.slice(0, 6).map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-wj-green/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-wj-green">
                          {new Date(ex.exception_date).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{ex.reason}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {new Date(ex.exception_date).toLocaleDateString(locale, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "text-[10px] shrink-0",
                        ex.exception_type === "closed"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30",
                      )}
                    >
                      {ex.exception_type === "closed" ? "Closed" : "Special"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* My working hours editor — scoped to current user only */}
      {me && (
        <StaffScheduleDialog
          open={mySchedOpen}
          onOpenChange={(v) => {
            setMySchedOpen(v);
            if (!v) setScheduleVersion((n) => n + 1);
          }}
          staffId={me.user_id}
          staffName={me.full_name ?? me.email ?? "Me"}
          staffEmail={me.email}
          weeklyAppointments={weeklyAppointments}
          weeklyCapacity={weeklyCapacity}
        />
      )}
    </RoleDashboardLayout>
  );
}