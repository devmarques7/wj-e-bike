import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, ScanLine } from "lucide-react";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import GarageBikeCard from "@/components/dashboard/garage/GarageBikeCard";
import BikeHealthGrid from "@/components/dashboard/garage/BikeHealthGrid";
import ServiceAllowanceCard from "@/components/dashboard/wallet/ServiceAllowanceCard";
import BookAppointmentDialog from "@/components/dashboard/scheduling/BookAppointmentDialog";
import { usePlanAllowance, PLAN_SERVICE_ALLOWANCE } from "@/hooks/wallet/usePlanAllowance";
import { supabase } from "@/integrations/supabase/client";
import AppointmentsTableCard from "@/components/dashboard/scheduling/AppointmentsTableCard";
import BikeAssistantCard from "@/components/dashboard/assistant/BikeAssistantCard";
import BikeAssessmentDialog from "@/components/dashboard/garage/BikeAssessmentDialog";
import { useBikeAssessment } from "@/hooks/garage/useBikeAssessment";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { useBikeById } from "@/hooks/garage/useBikeById";
import { useServiceBriefing } from "@/hooks/staff/useServiceBriefing";

/**
 * E-Pass identification screen: opened right after a QR scan.
 * Reuses the customer garage components (bike card, health grid, service history)
 * for the scanned rider's bike, with a Garage → Customer → Bike breadcrumb.
 */
export default function ScannedBikeDetail() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { bike, owner, loading, error, health, nextRevision, daysToRevision, refetch } =
    useBikeById(bikeId);
  const [plan, setPlan] = useState<{ name: string; slug: string } | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const allowance = usePlanAllowance(plan?.slug, owner?.userId ?? null);
  const { assessment, refetch: refetchAssessment } = useBikeAssessment(
    bike?.id ?? null,
    owner?.customerId ?? null,
  );

  const isStaffRole = user?.role === "staff" || user?.role === "admin";
  // Automated workshop briefing: appointment yes/no, reported problem,
  // plan coverage, parts to review and the booking window.
  const briefing = useServiceBriefing({
    ownerUserId: owner?.userId,
    bikeId: bike?.id ?? null,
    bikeModel: bike?.model ?? null,
    ownerName: owner?.name ?? owner?.email ?? null,
    planName: plan?.name ?? "Free",
    metrics: health.metrics,
    daysToRevision,
    enabled: isStaffRole,
  });

  const staffActions = useMemo(
    () => [
      {
        label: briefing.hasAppointment ? "Open booking" : "Create appointment",
        prompt: "",
        primary: true,
        onSelect: () => setBookingOpen(true),
      },
      {
        label: "What should I check first?",
        prompt: "Based on the workshop briefing, list the checks I should do on this bike, in order.",
      },
      {
        label: "Is this covered by the plan?",
        prompt: "Is the work needed on this bike covered by the customer's plan, or is it an extra charge?",
      },
      {
        label: "Parts & estimated time",
        prompt: "Which parts are likely needed and how long should this service take?",
      },
      {
        label: briefing.hasAppointment ? "Summarise the appointment" : "When should we book it?",
        prompt: briefing.hasAppointment
          ? "Summarise the customer's appointment and the reported problem for the workshop."
          : "This bike has no appointment. When should it be booked and what service should I choose?",
      },
    ],
    [briefing.hasAppointment],
  );

  // Active membership of the scanned rider — feeds the allowance counters.
  useEffect(() => {
    if (!owner?.userId) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, plan_versions(plans(name, slug))")
        .eq("user_id", owner.userId)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const p = (data as any)?.plan_versions?.plans;
      setPlan(p ? { name: p.name, slug: p.slug } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [owner?.userId]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  const isStaff = user?.role === "staff" || user?.role === "admin";
  const garageHref = isStaff ? "/dashboard/staff/garage" : "/dashboard/garage";
  // Where the scan started (e.g. /dashboard/garage?bike=<own-bike-id>), so the
  // breadcrumb takes the rider back to their own bike exactly as they left it.
  const stateReturn = (location.state as { returnTo?: string } | null)?.returnTo;
  const returnTo =
    stateReturn && stateReturn.startsWith("/dashboard") && !stateReturn.includes("/bike/")
      ? stateReturn
      : garageHref;
  const isOwnBike = !!owner?.userId && owner.userId === user?.id;
  const ownerName = owner?.name || owner?.email || "Unknown customer";
  const shortId = (bike?.id ?? bikeId ?? "").slice(0, 8).toUpperCase();

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={returnTo}>Garage</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {owner?.customerId && isStaff ? (
                  <BreadcrumbLink asChild>
                    <Link to={`/dashboard/admin/crm/${owner.customerId}`}>{ownerName}</Link>
                  </BreadcrumbLink>
                ) : !isStaff ? (
                  <BreadcrumbLink asChild>
                    <Link to={returnTo}>{isOwnBike ? "My bike" : "Back to my bike"}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground">{ownerName}</span>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Bike #{shortId}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-light text-foreground">
                {bike?.model ?? "E-Pass identification"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {bike?.serial ? `Serial ${bike.serial} · ` : ""}Owned by {ownerName}
              </p>
            </div>
            <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-widest text-primary">
              <ScanLine className="h-3 w-3" /> E-Pass verified
            </span>
          </div>
        </motion.div>

        {loading && (
          <div className="flex items-center gap-2 rounded-3xl border border-border/30 bg-card/40 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading bike record…
          </div>
        )}

        {!loading && !bike && (
          <div className="rounded-3xl border border-border/30 bg-card/40 p-6 text-sm text-muted-foreground">
            {error ?? "No bike found for this E-Pass."}
          </div>
        )}

        {!loading && bike && (
          <div className="grid grid-cols-12 gap-4 lg:gap-6">
            <div className="col-span-12 lg:col-span-8">
              <GarageBikeCard bike={bike} overall={health.overall} metrics={health.metrics} />
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 lg:gap-6">
              {/* Same plan + revision panel used on the customer wallet */}
              <ServiceAllowanceCard
                planName={plan?.name ?? "Free"}
                allowance={allowance}
                revisionDays={daysToRevision}
                revisionDate={nextRevision}
                bikeName={bike.model}
                contextLabel={isStaff ? `Coverage · ${ownerName}` : undefined}
                upgradeOptions={[
                  {
                    slug: plan?.slug ?? "free",
                    name: plan?.name ?? "Free",
                    percent: Math.round(
                      ((PLAN_SERVICE_ALLOWANCE[plan?.slug ?? "free"] ?? 1) /
                        Math.max(...Object.values(PLAN_SERVICE_ALLOWANCE))) * 100,
                    ),
                    current: true,
                  },
                  {
                    slug: "used",
                    name: "Used",
                    percent: allowance.total
                      ? Math.round((allowance.used / allowance.total) * 100)
                      : 0,
                  },
                  {
                    slug: "health",
                    name: "Health",
                    percent: health.overall,
                  },
                ]}
                onBook={() => setBookingOpen(true)}
                onUpgrade={() =>
                  isStaff && owner?.customerId
                    ? navigate(`/dashboard/admin/crm/${owner.customerId}`)
                    : navigate("/membership-plans")
                }
                manageLabel={isStaff ? "Book service" : "Manage"}
                onManage={() =>
                  isStaff ? setBookingOpen(true) : navigate("/dashboard/garage")
                }
              />
            </div>

            <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 lg:gap-6">
              <BikeHealthGrid
                metrics={health.metrics}
                assessment={assessment}
                onAssess={isStaffRole ? () => setAssessOpen(true) : undefined}
              />
              {owner?.userId && (
                <AppointmentsTableCard
                  customerUserId={owner.userId}
                  includeRequests
                  title="Service history & requests"
                />
              )}
            </div>
            <div className="col-span-12 lg:col-span-4">
              {isStaffRole ? (
                <BikeAssistantCard
                  className="h-full"
                  greeting="Workshop briefing ready — ask me what to do with this bike."
                  briefing={briefing.loading ? undefined : briefing.markdown}
                  extraContext={`STAFF MODE — you are assisting a WJ workshop technician (not the rider). Be concise, technical and action-oriented: what must be done on this bike, coverage, parts, and how to register an appointment.\n\n${briefing.markdown}`}
                  quickActions={staffActions}
                />
              ) : (
                <BikeAssistantCard className="h-full" />
              )}
            </div>
          </div>
        )}

        {owner?.userId && (
          <BookAppointmentDialog
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            onCreated={() => {
              setBookingOpen(false);
              refetch?.();
            }}
            presetCustomer={{
              user_id: owner.userId,
              full_name: owner.name,
              email: owner.email,
            }}
            presetBike={bike ? { model: bike.model, serial: bike.serial } : undefined}
            initialNotes={bike ? `[${bike.model}]` : undefined}
          />
        )}

        {bike && (
          <BikeAssessmentDialog
            open={assessOpen}
            onOpenChange={setAssessOpen}
            bikeId={bike.id}
            bikeModel={bike.model}
            customerId={owner?.customerId ?? null}
            onSaved={() => void refetchAssessment()}
          />
        )}
      </div>
    </RoleDashboardLayout>
  );
}

