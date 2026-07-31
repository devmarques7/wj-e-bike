import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import StyledEPassQR from "@/components/dashboard/StyledEPassQR";
import BikePickerDialog, { LinkedBike } from "@/components/dashboard/BikePickerDialog";
import WalletMemberCard, { WalletCardBack } from "@/components/dashboard/WalletMemberCard";
import WalletCardThemeDialog from "@/components/dashboard/WalletCardThemeDialog";
import { loadWalletThemes, saveWalletThemes, themeForIndex } from "@/lib/wallet/cardThemes";
import WalletActionTiles from "@/components/dashboard/wallet/WalletActionTiles";
import ServiceAllowanceCard from "@/components/dashboard/wallet/ServiceAllowanceCard";
import ScanEPassDialog from "@/components/dashboard/wallet/ScanEPassDialog";
import { usePlanAllowance, PLAN_SERVICE_ALLOWANCE } from "@/hooks/wallet/usePlanAllowance";
import { useGarageBike } from "@/hooks/garage/useGarageBike";
import { useSelectedBike } from "@/contexts/SelectedBikeContext";
import ActivityYearGrid from "@/components/dashboard/wallet/ActivityYearGrid";
import ActivityMonthGrid from "@/components/dashboard/wallet/ActivityMonthGrid";
import ActivityDayPanel from "@/components/dashboard/wallet/ActivityDayPanel";
import ServiceRecordDialog from "@/components/dashboard/wallet/ServiceRecordDialog";
import ArchivedBikesTable from "@/components/dashboard/wallet/ArchivedBikesTable";
import { useActivityYear, type ActivityDay, type ActivityRecord } from "@/hooks/wallet/useActivityYear";

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
  /** Rights granted by this plan, seeded per plan version in the database. */
  entitlements: PlanEntitlements;
};


// Apple Wallet stack geometry — every card shares the same bottom baseline and
// steps upward, getting narrower the further back it sits.
const WALLET_FIRST_PEEK = 42; // px the closest back card peeks above the featured card
const WALLET_STEP = 26; // px between each ascending step
/** Uniform taper applied per depth so every card keeps the exact same box. */
const WALLET_SCALE_STEP = 0.03;
/** Extra lift applied on hover (Apple Wallet "peek" gesture). */
const WALLET_HOVER_LIFT = 14;

const cardStyles: Record<string, { gradient: string; border: string; text: string }> = {
  free:  { gradient: "from-emerald-400 to-emerald-600", border: "border-emerald-400", text: "text-emerald-300" },
  light: { gradient: "from-zinc-400 to-zinc-600", border: "border-zinc-400", text: "text-zinc-300" },
  plus:  { gradient: "from-blue-400 to-blue-600", border: "border-blue-400", text: "text-blue-300" },
  black: { gradient: "from-amber-400 to-amber-600", border: "border-amber-400", text: "text-amber-300" },
};

/** Maximum rows rendered per page in the service history table. */
const HISTORY_PAGE_SIZE = 10;

export default function MyWallet() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [linkedBikes, setLinkedBikes] = useState<LinkedBike[]>([]);
  /** Card queue: index 0 is the featured card, the rest ascend behind it. */
  const [stackOrder, setStackOrder] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanInfo | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [history, setHistory] = useState<PointEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Per-card colour themes, persisted locally. */
  const [cardThemes, setCardThemes] = useState<Record<string, string>>(() => loadWalletThemes());
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [archivedRefresh, setArchivedRefresh] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  /** Year activity map + folder history state. */
  const [activityYear, setActivityYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<ActivityDay | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ActivityRecord | null>(null);
  const {
    records: activityRecords,
    daysMap,
    loading: activityLoading,
  } = useActivityYear(user?.id, activityYear);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1. Active plans
      const { data: allPlans } = await supabase
        .from("plans")
        .select("id, slug, name, tier_level, description, is_active, plan_versions:plan_versions(id, price, currency, interval, features, entitlements, status, version_number)")
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
            entitlements: parseEntitlements(v.entitlements),
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
      setPlans(planList);
      setHistory(entries);
      setLinkedBikes(bikes);
      setStackOrder(bikes.map((b) => b.id));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const totalPoints = useMemo(() => history.reduce((s, h) => s + h.points, 0), [history]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE)), [history]);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * HISTORY_PAGE_SIZE;
    return history.slice(start, start + HISTORY_PAGE_SIZE);
  }, [history, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [history.length]);

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

  /* --------- Apple Wallet queue --------- */
  const orderedBikes = useMemo(() => {
    const byId = new Map(linkedBikes.map((b) => [b.id, b]));
    const ordered = stackOrder.map((id) => byId.get(id)).filter(Boolean) as LinkedBike[];
    const missing = linkedBikes.filter((b) => !stackOrder.includes(b.id));
    return [...ordered, ...missing];
  }, [linkedBikes, stackOrder]);

  const activeBike = orderedBikes[0];

  /** Clicking a back card moves it to the front of the queue, while the previous front card
   * is sent to the back of the stack (last peek). */
  const bringToFront = (id: string) => {
    if (activeBike?.id === id) return;
    const ids = orderedBikes.map((b) => b.id);
    if (!ids.includes(id)) return;
    const oldFront = ids[0];
    const rest = ids.filter((x) => x !== id && x !== oldFront);
    setStackOrder(oldFront ? [id, ...rest, oldFront] : [id, ...rest]);
    setHoveredId(null);
    setIsFlipped(false);
  };

  const activeBikeId = activeBike?.id || (user as any)?.bikeId || user?.id || "unknown";
  const activeBikeName = activeBike?.model || (user as any)?.bikeName || t("e_pass.no_bike");
  const activeBikeSerial = activeBike?.serial || (user as any)?.bikeId || "—";
  const cardDigits = `4532${(user?.id || "0000")
    .replace(/\D/g, "")
    .padEnd(12, "0")
    .slice(-12)}`;
  const cardNumber = cardDigits.replace(/(.{4})/g, "$1 ").trim();

  /** Plan-covered appointment allowance (used / scheduled / remaining). */
  const allowance = usePlanAllowance(currentPlan?.slug);

  /**
   * Care-efficiency ranking: the current plan plus the tiers above it.
   * `percent` is the plan's coverage relative to the best plan available
   * (100% = maximum care efficiency), so the dotted rings fill gradually.
   */
  const upgradeOptions = useMemo(() => {
    const currentTier = currentPlan?.tier_level ?? 0;
    const currentSlug = currentPlan?.slug ?? "free";
    const maxAllowance = Math.max(
      1,
      ...plans.map((p) => PLAN_SERVICE_ALLOWANCE[p.slug] ?? 1),
      PLAN_SERVICE_ALLOWANCE[currentSlug] ?? 1,
    );
    const higher = plans
      .filter((p) => p.tier_level > currentTier)
      .sort((a, b) => a.tier_level - b.tier_level)
      .slice(0, 2);
    const current = plans.find((p) => p.slug === currentSlug);
    const list = [
      ...higher.map((p) => ({ slug: p.slug, name: p.name, current: false })),
      {
        slug: currentSlug,
        name: current?.name ?? currentPlan?.name ?? "Free",
        current: true,
      },
    ];
    return list.map((p) => ({
      ...p,
      percent: Math.round(((PLAN_SERVICE_ALLOWANCE[p.slug] ?? 1) / maxAllowance) * 100),
    }));
  }, [plans, currentPlan]);
  /** Bike condition + next revision, reused from the Garage health model. */
  const { bike: garageBike, health, nextRevision, daysToRevision } = useGarageBike(activeBike?.id ?? null);

  /** Front card of the wallet defines the bike scope for the whole app. */
  const { selectBike, bikeId: scopedBikeId } = useSelectedBike();
  useEffect(() => {
    if (activeBike?.id && activeBike.id !== scopedBikeId) selectBike(activeBike.id);
  }, [activeBike?.id, scopedBikeId, selectBike]);

  /** Resolves the theme for a card, falling back to a distinct default per position. */
  const themeFor = (id: string) => {
    if (cardThemes[id]) return cardThemes[id];
    // Stable fallback: based on the bike's original position, never on stack order,
    // so a card keeps its colour when moved to the front.
    const idx = Math.max(0, linkedBikes.findIndex((b) => b.id === id));
    return themeForIndex(idx);
  };

  const applyTheme = (id: string, themeId: string) => {
    setCardThemes((prev) => {
      const next = { ...prev, [id]: themeId };
      saveWalletThemes(next);
      return next;
    });
  };

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
          <div
            className="w-full h-full overflow-visible"
            style={{
              paddingTop: `${WALLET_FIRST_PEEK + Math.max(0, linkedBikes.length - 1) * WALLET_STEP + 12}px`,
            }}
          >
            <div className="relative w-full h-full group">
            {/* Stacked back cards — same box, uniform ascending step above the featured card */}
            {orderedBikes.slice(1).map((bike, depth) => {
              const hovered = hoveredId === bike.id;
              const peek = WALLET_FIRST_PEEK + depth * WALLET_STEP; // px peeking above main card
              const lift = hovered ? WALLET_HOVER_LIFT : 0;
              const scale = 1 - (depth + 1) * WALLET_SCALE_STEP;
              return (
                <motion.button
                  key={bike.id}
                  layout
                  type="button"
                  onClick={(e) => { e.stopPropagation(); bringToFront(bike.id); }}
                  onMouseEnter={() => setHoveredId(bike.id)}
                  onMouseLeave={() => setHoveredId((prev) => (prev === bike.id ? null : prev))}
                  className="absolute inset-x-0 bottom-0 aspect-[1.6/1] sm:aspect-[1.75/1] rounded-3xl overflow-hidden shadow-xl origin-bottom text-left hover:shadow-[0_25px_60px_-12px_rgba(5,140,66,0.45)]"
                  initial={false}
                  animate={{ y: -(peek + lift), scale }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  style={{ zIndex: 20 - (depth + 1) }}
                  title={bike.model || bike.serial}
                >
                  <WalletMemberCard
                    themeId={themeFor(bike.id)}
                    label={t("e_pass.bike", { defaultValue: "Bike" })}
                    bikeName={bike.model || t("e_pass.no_bike")}
                    serial={bike.serial || undefined}
                    planName={currentPlan?.name ?? "Free"}
                    memberName={user?.name || "Guest"}
                    cardNumber={cardNumber}
                  />
                </motion.button>
              );
            })}

            {/* Featured card — always in front */}
            <motion.div
              key={activeBikeId}
              initial={{ y: -34, scale: 0.95, opacity: 0.55 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-30 aspect-[1.6/1] sm:aspect-[1.75/1] cursor-pointer origin-top hover:-translate-y-2 hover:shadow-[0_25px_60px_-12px_rgba(5,140,66,0.45)]"
              style={{ perspective: "1200px", zIndex: 30 }}
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
                  className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "translateZ(1px)",
                    opacity: isFlipped ? 0 : 1,
                    pointerEvents: isFlipped ? "none" : "auto",
                  }}
                >
                  <WalletMemberCard
                    themeId={themeFor(activeBikeId)}
                    label={t("e_pass.member_card")}
                    bikeName={activeBikeName !== t("e_pass.no_bike") ? activeBikeName : "WJ Vision"}
                    serial={activeBikeSerial}
                    planName={currentPlan?.name ?? "Free"}
                    memberName={user?.name || "Guest"}
                    cardNumber={cardNumber}
                    points={totalPoints}
                    pointsLabel={t("e_pass.total_points")}
                    showEdit
                    onEdit={() => setEditingCardId(activeBikeId)}
                  />
                </div>
                {/* BACK */}
                <div
                  className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg) translateZ(1px)",
                    opacity: isFlipped ? 1 : 0,
                    pointerEvents: isFlipped ? "auto" : "none",
                  }}
                >
                  <WalletCardBack
                    themeId={themeFor(activeBikeId)}
                    planName={currentPlan?.name ?? "Free"}
                    qr={
                      <StyledEPassQR
                        data={`https://wjbikes.nl/epass/${activeBikeId}`}
                        size={200}
                        className="!w-full !h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full"
                        overrides={{ backgroundColor: "transparent" }}
                      />
                    }
                    rows={[
                      ...(user?.email
                        ? [{ label: t("e_pass.email", { defaultValue: "Email" }), value: user.email }]
                        : []),
                      { label: t("e_pass.member", { defaultValue: "Owner" }), value: user?.name || "Guest" },
                      { label: t("e_pass.bike", { defaultValue: "Bike" }), value: activeBikeName },
                      ...(activeBikeSerial
                        ? [{ label: t("e_pass.serial", { defaultValue: "Serial" }), value: activeBikeSerial }]
                        : []),
                    ]}
                  />
                </div>
              </div>
            </motion.div>

            {/* Bike switcher dots */}
            {orderedBikes.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {orderedBikes.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={(e) => { e.stopPropagation(); bringToFront(b.id); }}
                    className={`h-2 rounded-full transition-all ${i === 0 ? "w-6 bg-wj-green" : "w-2 bg-border hover:bg-muted-foreground/40"}`}
                    aria-label={b.model || `Bike ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Right column — Plan services */}
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <ServiceAllowanceCard
                planName={currentPlan?.name ?? "Free"}
                allowance={allowance}
                revisionDays={daysToRevision}
                revisionDate={nextRevision}
                bikeName={garageBike?.model || activeBikeName}
                upgradeOptions={upgradeOptions}
                onUpgrade={() => navigate("/membership-plans")}
                onBook={() => navigate("/dashboard/garage")}
              />
            </div>

            {/* Shortcuts — scan / add card rail + wide tiles */}
            <div className="mt-6">
              <WalletActionTiles
                onScan={() => setScanOpen(true)}
                onAddCard={() => setPickerOpen(true)}
                onTips={() => navigate("/dashboard/garage")}
                onPlans={() => navigate("/membership-plans")}
                onAllBikes={() => navigate("/dashboard/bike")}
              />
            </div>
          </div>
        </div>

        {/* Year activity map + folder history */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-12">
            {selectedDay ? (
              <ActivityDayPanel
                day={selectedDay}
                backLabel={expandedMonth !== null ? "Back to month" : "Back to year"}
                onBack={() => setSelectedDay(null)}
                healthScore={health?.overall}
                bikeName={garageBike?.model || activeBikeName}
                onOpenRecord={(r) => setSelectedRecord(r)}
                daysMap={daysMap}
                onSelectDay={setSelectedDay}
              />
            ) : expandedMonth === null ? (
              <ActivityYearGrid
                year={activityYear}
                daysMap={daysMap}
                onYearChange={setActivityYear}
                onSelectDay={(d) => {
                  setExpandedMonth(new Date(d.date).getMonth());
                  setSelectedDay(d);
                }}
                onExpandMonth={setExpandedMonth}
                selectedDate={selectedDay?.date ?? null}
                loading={activityLoading}
              />
            ) : (
              <ActivityMonthGrid
                year={activityYear}
                month={expandedMonth}
                daysMap={daysMap}
                onMonthChange={setExpandedMonth}
                onClose={() => setExpandedMonth(null)}
                onSelectDay={setSelectedDay}
                selectedDate={selectedDay?.date ?? null}
              />
            )}
          </div>

        </div>

        <ServiceRecordDialog
          record={selectedRecord}
          onOpenChange={(o) => !o && setSelectedRecord(null)}
        />

        <ArchivedBikesTable refreshKey={archivedRefresh} />
      </div>

      <WalletCardThemeDialog
        open={editingCardId !== null}
        onOpenChange={(o) => !o && setEditingCardId(null)}
        themeId={editingCardId ? themeFor(editingCardId) : undefined}
        onSelect={(themeId) => editingCardId && applyTheme(editingCardId, themeId)}
        bikeId={editingCardId}
        onCancelled={(bikeId) => {
          setLinkedBikes((prev) => prev.filter((b) => b.id !== bikeId));
          setStackOrder((prev) => prev.filter((id) => id !== bikeId));
          setEditingCardId(null);
          setArchivedRefresh((n) => n + 1);
        }}
        preview={{
          label: t("e_pass.member_card"),
          bikeName: activeBikeName !== t("e_pass.no_bike") ? activeBikeName : "WJ Vision",
          serial: activeBikeSerial,
          planName: currentPlan?.name ?? "Free",
          memberName: user?.name || "Guest",
          cardNumber,
        }}
      />

      <BikePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onRegistered={(bike) => {
          setLinkedBikes((prev) => [bike, ...prev]);
          setStackOrder((prev) => [bike.id, ...prev.filter((id) => id !== bike.id)]);
          // Flip card back to front so user sees the new bike
          setIsFlipped(false);
        }}
      />

      <ScanEPassDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        bikeId={activeBikeId}
        bikeName={activeBikeName}
        memberName={user?.name || "Guest"}
        planName={currentPlan?.name ?? "Free"}
      />

    </RoleDashboardLayout>
  );
}
