import { motion } from "framer-motion";
import { Wrench, Clock, Calendar, Plus, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import EmptyState from "@/components/dashboard/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import StyledEPassQR from "@/components/dashboard/StyledEPassQR";
import BikePickerDialog, { LinkedBike } from "@/components/dashboard/BikePickerDialog";

type PointEntry = {
  id: string;
  date: string;
  service: string;
  points: number;
  status: string;
};

type PlanInfo = {
  slug: string;
  name: string;
  tier_level: number;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  description: string | null;
};


const cardStyles: Record<string, { gradient: string; border: string; text: string }> = {
  free:  { gradient: "from-emerald-400 to-emerald-600", border: "border-emerald-400", text: "text-emerald-300" },
  light: { gradient: "from-zinc-400 to-zinc-600", border: "border-zinc-400", text: "text-zinc-300" },
  plus:  { gradient: "from-blue-400 to-blue-600", border: "border-blue-400", text: "text-blue-300" },
  black: { gradient: "from-amber-400 to-amber-600", border: "border-amber-400", text: "text-amber-300" },
};

export default function MyWallet() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [linkedBikes, setLinkedBikes] = useState<LinkedBike[]>([]);
  const [activeBikeIdx, setActiveBikeIdx] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<PlanInfo | null>(null);
  const [history, setHistory] = useState<PointEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1. Active plans
      const { data: allPlans } = await supabase
        .from("plans")
        .select("id, slug, name, tier_level, description, is_active, plan_versions:plan_versions(id, price, currency, interval, features, status, version_number)")
        .eq("is_active", true)
        .order("tier_level", { ascending: true });

      const planList: PlanInfo[] = (allPlans ?? [])
        .map((p: any) => {
          const v = (p.plan_versions ?? [])
            .filter((x: any) => x.status === "active")
            .sort((a: any, b: any) => b.version_number - a.version_number)[0];
          if (!v) return null;
          return {
            slug: p.slug,
            name: p.name,
            tier_level: p.tier_level,
            price: Number(v.price ?? 0),
            currency: v.currency || "EUR",
            interval: v.interval || "monthly",
            features: Array.isArray(v.features) ? v.features : [],
            description: p.description,
          } as PlanInfo;
        })
        .filter(Boolean) as PlanInfo[];

      // 2. User subscription
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("plan_versions:plan_version_id(plan_id, plans:plan_id(slug))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const sub: any = subs?.[0];
      const slug: string = sub?.plan_versions?.plans?.slug ?? "free";
      const cur = planList.find((p) => p.slug === slug) ?? planList.find((p) => p.slug === "free") ?? null;

      // 3. Points history from completed appointments
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, scheduled_date, status, service_types:service_type_id(name, name_en, reward_points)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("scheduled_date", { ascending: false })
        .limit(50);

      const entries: PointEntry[] = (appts ?? []).map((a: any) => ({
        id: a.id,
        date: a.scheduled_date,
        service: a.service_types?.name_en || a.service_types?.name || "Service",
        points: a.service_types?.reward_points ?? 0,
        status: a.status,
      }));

      // 4. Linked bikes
      let bikes: LinkedBike[] = [];
      if (!(user as any)?.isDemo) {
        const { data: cp } = await supabase
          .from("customer_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cp?.id) {
          const { data: cbs } = await supabase
            .from("customer_bikes")
            .select("id, model, serial, color")
            .eq("customer_id", cp.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false });
          bikes = (cbs as LinkedBike[]) ?? [];
        }
      }
      if (bikes.length === 0 && (user as any)?.bikeId) {
        bikes = [{ id: (user as any).bikeId, model: (user as any).bikeName ?? null, serial: (user as any).bikeId, color: null }];
      }

      if (cancelled) return;
      setCurrentPlan(cur);
      setHistory(entries);
      setLinkedBikes(bikes);
      setActiveBikeIdx(0);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const totalPoints = useMemo(() => history.reduce((s, h) => s + h.points, 0), [history]);

  // Next maintenance: 3 months from last completed appointment
  const nextMaintenance = useMemo(() => {
    if (history.length === 0) return null;
    const last = new Date(history[0].date);
    const next = new Date(last);
    next.setMonth(next.getMonth() + 3);
    const days = Math.ceil((next.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { date: next, days };
  }, [history]);

  const nextMaintenanceLabel = nextMaintenance
    ? nextMaintenance.days < 0
      ? t("e_pass.overdue")
      : nextMaintenance.days === 0
      ? t("e_pass.today")
      : t("e_pass.in_days", { n: nextMaintenance.days })
    : t("e_pass.not_scheduled");

  const slug = currentPlan?.slug ?? "free";
  const styles = cardStyles[slug] ?? cardStyles.free;

  const activeBike = linkedBikes[activeBikeIdx];
  const activeBikeId = activeBike?.id || (user as any)?.bikeId || user?.id || "unknown";
  const activeBikeName = activeBike?.model || (user as any)?.bikeName || t("e_pass.no_bike");
  const activeBikeSerial = activeBike?.serial || (user as any)?.bikeId || "—";
  const canLinkAnother = linkedBikes.length < 5;

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-2"
        >
          <h1 className="text-xl sm:text-2xl font-light text-foreground">{t("e_pass.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("e_pass.subtitle")}</p>
        </motion.div>

        {/* Main grid: featured card + plan/actions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 lg:items-stretch">
          {/* Left column — Featured member card */}
          <div className="w-full pt-10" style={{ paddingTop: `${40 + Math.max(0, linkedBikes.length - 1) * 28}px` }}>
            <div className="relative w-full group">
            {/* Stacked back cards (one per non-active bike) — peek above the main card */}
            {linkedBikes.map((bike, i) => {
              if (i === activeBikeIdx) return null;
              // Order from furthest (top) to closest (just behind main)
              const stackOrder = linkedBikes
                .map((_, idx) => idx)
                .filter((idx) => idx !== activeBikeIdx);
              const depth = stackOrder.indexOf(i); // 0 = closest to main
              const peek = 24 + depth * 22; // px peeking above main card
              const tierStyle = cardStyles[slug] ?? cardStyles.free;
              return (
                <button
                  key={bike.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveBikeIdx(i); setIsFlipped(false); }}
                  className={`absolute left-0 right-0 aspect-[1.6/1] rounded-3xl overflow-hidden bg-gradient-to-br from-background to-secondary border border-border/60 shadow-xl transition-all duration-300 origin-top text-left hover:-translate-y-2 hover:shadow-[0_25px_60px_-12px_rgba(5,140,66,0.45)] hover:border-wj-green/60`}
                  style={{ top: `-${peek}px`, zIndex: 10 + depth }}
                  title={bike.model || bike.serial}
                >
                  <div className="h-full px-5 pt-3 pb-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-medium">{t("e_pass.bike", { defaultValue: "Bike" })}</p>
                      <p className="text-foreground text-sm font-semibold truncate">{bike.model || t("e_pass.no_bike")}</p>
                    </div>
                    <div className={`px-2.5 py-0.5 rounded-full border ${tierStyle.border} ${tierStyle.text} text-[9px] font-bold uppercase tracking-wider bg-transparent`}>
                      {currentPlan?.name ?? "Free"}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Ghost stacked card (add new) — sits at the very top of the stack */}
            {(() => {
              const otherCount = Math.max(0, linkedBikes.length - 1);
              const ghostTop = 40 + otherCount * 22;
              return (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={!canLinkAnother}
                  title={canLinkAnother ? t("e_pass.add_bike_hint") : t("e_pass.no_other_bike")}
                  className="absolute left-0 right-0 aspect-[1.6/1] rounded-3xl border-2 border-dashed border-border/50 bg-card/60 backdrop-blur-md flex flex-col items-center justify-center gap-2 text-muted-foreground transition-all duration-300 hover:-translate-y-5 hover:border-wj-green hover:bg-wj-green/10 hover:text-wj-green hover:shadow-[0_35px_70px_-12px_rgba(5,140,66,0.55)] active:translate-y-[-2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:border-border/50 disabled:hover:text-muted-foreground disabled:hover:shadow-none disabled:hover:bg-card/60"
                  style={{ top: `-${ghostTop}px`, zIndex: 5 }}
                >
                  <div className="p-2.5 rounded-full bg-wj-green/10 border border-wj-green/30 transition-colors group-hover:bg-wj-green/20">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] uppercase tracking-widest">{t("e_pass.add_bike_hint")}</span>
                </button>
              );
            })()}

            {/* Featured card — always in front */}
            <div
              className="relative z-20 aspect-[1.6/1] sm:aspect-[1.75/1] cursor-pointer"
              style={{ perspective: "1200px" }}
              onClick={() => setIsFlipped((v) => !v)}
              role="button"
              aria-label={t("e_pass.tap_to_flip")}
            >
              <div
                className="relative w-full h-full transition-transform duration-700"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* FRONT */}
                <div
                  className="absolute inset-0 rounded-3xl overflow-hidden bg-gradient-to-br from-background to-secondary border border-border/60 shadow-2xl"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "translateZ(1px)",
                    opacity: isFlipped ? 0 : 1,
                    pointerEvents: isFlipped ? "none" : "auto",
                  }}
                >
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-wj-green blur-3xl" />
                    <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full bg-wj-green blur-2xl" />
                  </div>
                  <div className="relative z-10 h-full p-4 sm:p-5 lg:p-6 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">{t("e_pass.member_card")}</p>
                        <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">WJ Vision</h3>
                      </div>
                      <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${styles.gradient} text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white`}>
                        {currentPlan?.name ?? "Free"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-widest">{t("e_pass.card_number")}</p>
                      <p className="text-foreground text-sm sm:text-base lg:text-lg font-mono tracking-[0.1em] sm:tracking-[0.15em]">
                        4532 •••• •••• {(user?.id || "0000").replace(/-/g, "").slice(-4).toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-widest mb-0.5">{t("e_pass.member")}</p>
                        <p className="text-foreground text-xs sm:text-sm font-medium">{user?.name || "Guest"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-widest mb-0.5">{t("e_pass.total_points")}</p>
                        <p className="text-wj-green text-base sm:text-lg font-bold">{totalPoints.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* BACK */}
                <div
                  className="absolute inset-0 rounded-3xl overflow-hidden bg-gradient-to-br from-background to-secondary border border-border/60 shadow-2xl"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg) translateZ(1px)",
                    opacity: isFlipped ? 1 : 0,
                    pointerEvents: isFlipped ? "auto" : "none",
                  }}
                >
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-4 left-4 w-32 h-32 rounded-full bg-wj-green blur-3xl" />
                    <div className="absolute bottom-4 right-4 w-24 h-24 rounded-full bg-wj-green blur-2xl" />
                  </div>
                  <div className="relative z-10 h-full p-4 sm:p-5 lg:p-6 grid grid-cols-[1fr_auto] gap-4 sm:gap-6">
                    {/* LEFT: accent + QR pinned to bottom */}
                    <div className="flex flex-col justify-between min-w-0">
                      <div className="flex flex-col items-start leading-none select-none">
                        <span className="text-[9px] sm:text-[10px] text-wj-green/80 tracking-[0.2em] uppercase font-medium">E-Pass</span>
                        <span className="text-xl sm:text-2xl font-bold text-wj-green tracking-tight">WJ</span>
                      </div>
                      <div className="w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] lg:w-[180px] lg:h-[180px] flex items-center justify-center overflow-hidden">
                        <StyledEPassQR
                          data={`https://wjbikes.nl/epass/${activeBikeId}`}
                          size={200}
                          className="!w-full !h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full"
                          overrides={{ backgroundColor: "transparent" }}
                        />
                      </div>
                    </div>

                    {/* RIGHT: stacked member details, label above value */}
                    <div className="flex flex-col justify-end items-start text-left gap-3 sm:gap-4 min-w-0 py-2">
                      {user?.email && (
                        <div className="min-w-0 max-w-[180px]">
                          <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{t("e_pass.email", { defaultValue: "Email" })}</p>
                          <p className="text-foreground text-[11px] sm:text-xs font-medium truncate">{user.email}</p>
                        </div>
                      )}
                      <div className="min-w-0 max-w-[180px]">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{t("e_pass.member", { defaultValue: "Owner" })}</p>
                        <p className="text-foreground text-sm sm:text-base font-semibold truncate">{user?.name || "Guest"}</p>
                      </div>
                      <div className="min-w-0 max-w-[180px]">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{t("e_pass.bike", { defaultValue: "Bike" })}</p>
                        <p className="text-foreground text-[11px] sm:text-xs font-medium truncate">{activeBikeName}</p>
                      </div>
                      {activeBikeSerial && (
                        <div className="min-w-0 max-w-[180px]">
                          <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{t("e_pass.serial", { defaultValue: "Serial" })}</p>
                          <p className="text-foreground text-[11px] sm:text-xs font-mono tracking-wider truncate">{activeBikeSerial}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bike switcher dots */}
            {linkedBikes.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {linkedBikes.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={(e) => { e.stopPropagation(); setActiveBikeIdx(i); }}
                    className={`h-2 rounded-full transition-all ${i === activeBikeIdx ? "w-6 bg-wj-green" : "w-2 bg-border hover:bg-muted-foreground/40"}`}
                    aria-label={b.model || `Bike ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Right column — Plan details + actions */}
          <div className="h-full flex flex-col gap-4">
            {/* Current plan details */}
            <div className="flex-1 rounded-3xl border border-border/50 bg-card p-5 lg:p-6 flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("e_pass.current_plan_sub")}</p>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">{currentPlan?.name ?? "Free"}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{currentPlan?.description ?? t("e_pass.no_benefits")}</p>
                </div>
                <div className="flex flex-row items-center gap-2 shrink-0 h-fit">
                  <div className={`px-3 py-1 rounded-full border-2 bg-transparent ${styles.border} ${styles.text} text-xs font-bold uppercase tracking-wider shrink-0 h-fit`}>
                    {currentPlan?.name ?? "Free"}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate("/membership-plans")}
                    className="rounded-full gradient-wj text-white hover:opacity-90 text-xs font-semibold px-4 py-1 h-7"
                  >
                    {t("e_pass.upgrade_btn", { defaultValue: "Upgrade" })}
                  </Button>
                </div>
              </div>

              {currentPlan?.features && currentPlan.features.length > 0 ? (
                <ul className="mt-4 space-y-2 flex-1 overflow-y-auto pr-1">
                  {currentPlan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                      <Check className="h-4 w-4 text-wj-green shrink-0 mt-0.5" />
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">{t("e_pass.no_benefits")}</p>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex-1 min-h-0 rounded-2xl border border-border/50 bg-card/60 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-wj-green/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-wj-green" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("e_pass.next_maintenance")}</p>
                  <p className="text-sm font-semibold text-foreground truncate">{nextMaintenanceLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History table container (w-full) */}
        <div className="w-full">
          <div className="h-full rounded-3xl border border-border/50 bg-card overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-wj-green/10 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-wj-green" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t("e_pass.transactions")}</h3>
                    <p className="text-xs text-muted-foreground">{t("e_pass.transactions_sub")}</p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="flex gradient-wj text-white hover:opacity-90"
                  size="sm"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t("e_pass.schedule_now")}</span>
                  <span className="sm:hidden">{t("e_pass.schedule_now_short")}</span>
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-[240px] overflow-y-auto">
              {history.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title={loading ? t("e_pass.history.loading_title") : t("e_pass.history.empty_title")}
                  description={loading ? t("e_pass.history.loading_desc") : t("e_pass.history.empty_desc")}
                  className="h-full"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground">{t("e_pass.history.date")}</TableHead>
                      <TableHead className="text-muted-foreground">{t("e_pass.history.service")}</TableHead>
                      <TableHead className="text-muted-foreground text-right">{t("e_pass.history.points")}</TableHead>
                      <TableHead className="text-muted-foreground text-right">{t("e_pass.history.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item, index) => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.4) }}
                        className="border-border/30 hover:bg-muted/30"
                      >
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">{item.service}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-wj-green font-semibold">+{item.points}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="px-2 py-0.5 rounded-full bg-wj-green/10 text-wj-green text-xs font-medium capitalize">
                            {item.status}
                          </span>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>

      <BikePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onRegistered={(bike) => {
          setLinkedBikes((prev) => [bike, ...prev]);
          setActiveBikeIdx(0);
          // Flip card back to front so user sees the new bike
          setIsFlipped(false);
        }}
      />
    </RoleDashboardLayout>
  );
}
