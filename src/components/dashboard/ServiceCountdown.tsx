import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, CheckCircle, Wrench, Plus, Settings2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import serviceBikeFull from "@/assets/service-bike-full.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EmptyState from "./EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BookAppointmentDialog from "./scheduling/BookAppointmentDialog";

const SERVICE_CYCLE_DAYS = 90; // 3 months

type Bike = {
  id: string;
  model: string;
  serial: string | null;
  purchased_at: string | null;
  last_service_at: string | null;
  next_service_at: string | null;
  services_completed: number;
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Revision cycle rule (always returns a minimum expected next revision):
 * - never serviced  -> baseline is the purchase date  (+3 months)
 * - already serviced -> baseline is the last service date (+3 months)
 * Only when neither date exists do we ask the rider to set it up.
 */
function resolveCycle(bike: Bike) {
  const baseISO = bike.last_service_at ?? bike.purchased_at;
  if (!baseISO) return null;
  const last = new Date(baseISO);
  const next = bike.next_service_at ? new Date(bike.next_service_at) : addDays(last, SERVICE_CYCLE_DAYS);
  return { last, next, fromPurchase: !bike.last_service_at };
}

interface ServiceCountdownProps {
  /** Bike selected by the page-level BikeTabs selector. */
  bikeId?: string | null;
  /**
   * Render a bike that does not belong to the logged-in user (E-Pass scan).
   * When provided the component skips its own fetch and uses this record.
   */
  externalBike?: Partial<Bike> & { id: string; model: string } | null;
  /** Owner of the external bike, used to preset the booking dialog. */
  externalOwner?: { userId: string | null; name: string | null; email: string | null } | null;
}

export default function ServiceCountdown({ bikeId, externalBike, externalOwner }: ServiceCountdownProps = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Registration dialog state
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [formPurchased, setFormPurchased] = useState("");
  const [formLastService, setFormLastService] = useState("");
  const [formServicesCount, setFormServicesCount] = useState("0");
  const [saving, setSaving] = useState(false);

  // Booking dialog state
  const [bookingBike, setBookingBike] = useState<Bike | null>(null);

  const isDemo = !!user?.isDemo;
  const isRealUser = !!user && !isDemo;

  const loadBikes = useCallback(async () => {
    if (externalBike) {
      setBikes([
        {
          id: externalBike.id,
          model: externalBike.model,
          serial: externalBike.serial ?? null,
          purchased_at: externalBike.purchased_at ?? null,
          last_service_at: externalBike.last_service_at ?? null,
          next_service_at: externalBike.next_service_at ?? null,
          services_completed: externalBike.services_completed ?? 0,
        },
      ]);
      setLoading(false);
      return;
    }
    if (!isRealUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: cp } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!cp?.id) {
      setBikes([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("customer_bikes")
      .select("id, model, serial, purchased_at, last_service_at, next_service_at, services_completed")
      .eq("customer_id", cp.id)
      .order("created_at", { ascending: false });

    if (!error && data) setBikes(data as Bike[]);
    setLoading(false);
  }, [externalBike, isRealUser, user?.id]);

  useEffect(() => {
    loadBikes();
  }, [loadBikes]);

  // Follow the bike selected at page level.
  useEffect(() => {
    if (!bikeId) return;
    const idx = bikes.findIndex((b) => b.id === bikeId);
    if (idx >= 0) setActiveIndex(idx);
  }, [bikeId, bikes]);

  // Video loop handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      if (video.duration - video.currentTime < 0.5) {
        video.style.opacity = "0";
        setTimeout(() => {
          video.currentTime = 0;
          video.play();
          video.style.opacity = "1";
        }, 300);
      }
    };
    video.play().catch(() => {});
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  const openSetup = (bike: Bike) => {
    setEditingBike(bike);
    setFormPurchased(bike.purchased_at ?? "");
    setFormLastService(bike.last_service_at ?? toISODate(new Date()));
    setFormServicesCount(String(bike.services_completed ?? 0));
  };

  const handleSaveSetup = async () => {
    if (!editingBike) return;
    if (!formPurchased && !formLastService) {
      toast.error("Add the purchase date or the last service date.");
      return;
    }
    setSaving(true);
    const last = new Date(formLastService || formPurchased);
    const next = addDays(last, SERVICE_CYCLE_DAYS);
    const count = Math.max(0, parseInt(formServicesCount || "0", 10) || 0);

    const { error } = await supabase
      .from("customer_bikes")
      .update({
        purchased_at: formPurchased || null,
        last_service_at: formLastService || null,
        next_service_at: toISODate(next),
        services_completed: count,
      })
      .eq("id", editingBike.id);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Service schedule saved");
    setEditingBike(null);
    loadBikes();
  };

  const openBooking = (bike: Bike) => {
    setBookingBike(bike);
  };

  // ---------- Empty state (no bikes registered) ----------
  if ((!isRealUser && !externalBike) || loading || bikes.length === 0) {
    if (loading) {
      return (
        <div className="relative h-full min-h-[400px] rounded-3xl overflow-hidden border border-border/40 bg-card/30 backdrop-blur-md flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="relative h-full min-h-[400px] rounded-3xl overflow-hidden border border-border/40 bg-card/30 backdrop-blur-md flex items-center justify-center"
      >
        <EmptyState
          icon={Wrench}
          title="No service scheduled"
          description="Register a bike to start tracking your service cycle."
        />
      </motion.div>
    );
  }

  const active = bikes[Math.min(activeIndex, bikes.length - 1)];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="relative h-full min-h-[400px] rounded-3xl overflow-hidden"
      >
        {/* Layer 1: Video Background */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/service-countdown-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-[75%] pointer-events-none">
          <img
            src={serviceBikeFull}
            alt="Bike"
            className="w-full h-full object-contain object-left-bottom opacity-90"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none" />

        {/* Card switcher header (when >1 bike) */}
        {!bikeId && bikes.length > 1 && (
          <div className="absolute top-3 right-3 z-20 flex gap-1.5">
            {bikes.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === activeIndex ? "bg-wj-green w-6" : "bg-muted-foreground/40 w-2"
                )}
                aria-label={`Show bike ${i + 1}`}
              />
            ))}
          </div>
        )}

        <div className="relative z-10 h-full">
          <BikeServiceCard
            key={active.id}
            bike={active}
            onSetup={() => openSetup(active)}
            onBook={() => openBooking(active)}
          />
        </div>
      </motion.div>

      {/* Setup / edit dialog */}
      <Dialog open={!!editingBike} onOpenChange={(open) => !open && setEditingBike(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Service setup · {editingBike?.model}</DialogTitle>
            <DialogDescription>
              We use these dates to predict your next revision. The cycle runs every 3 months.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="purchased">Purchase date</Label>
              <Input
                id="purchased"
                type="date"
                max={toISODate(new Date())}
                value={formPurchased}
                onChange={(e) => setFormPurchased(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastService">Last service date</Label>
              <Input
                id="lastService"
                type="date"
                max={toISODate(new Date())}
                value={formLastService}
                onChange={(e) => setFormLastService(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Next service will be auto-scheduled 3 months from this date.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="services">Services completed so far</Label>
              <Input
                id="services"
                type="number"
                min={0}
                value={formServicesCount}
                onChange={(e) => setFormServicesCount(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingBike(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveSetup} disabled={saving} className="bg-wj-green hover:bg-wj-green/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking dialog */}
      {/* Booking dialog — reuses the admin BookAppointmentDialog with the
          current user + selected bike preset, so members go straight to
          the service + real-time availability steps. */}
      {user?.id && (
        <BookAppointmentDialog
          open={!!bookingBike}
          onOpenChange={(v) => !v && setBookingBike(null)}
          onCreated={() => {
            setBookingBike(null);
            loadBikes();
          }}
          presetCustomer={{
            user_id: user.id,
            full_name: (user as any).full_name ?? (user as any).name ?? null,
            email: user.email ?? null,
          }}
          presetBike={
            bookingBike
              ? { model: bookingBike.model, serial: bookingBike.serial }
              : undefined
          }
          initialNotes={bookingBike ? `[${bookingBike.model}]` : undefined}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Inner per-bike card — keeps the original visual layout (countdown + bars + slider)
// -----------------------------------------------------------------------------
function BikeServiceCard({
  bike,
  onSetup,
  onBook,
}: {
  bike: Bike;
  onSetup: () => void;
  onBook: () => void;
}) {
  const cycle = resolveCycle(bike);
  const needsSetup = !cycle;

  const x = useMotionValue(0);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const thumbWidth = 48; // matches w-12
  const [maxDrag, setMaxDrag] = useState(200);

  useEffect(() => {
    const el = sliderTrackRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      // 4px padding each side (left-1/top-1/bottom-1 = 0.25rem)
      setMaxDrag(Math.max(40, w - thumbWidth - 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const backgroundColor = useTransform(
    x,
    [0, maxDrag],
    ["rgba(5, 140, 66, 0.1)", "rgba(5, 140, 66, 0.3)"]
  );
  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
  const checkOpacity = useTransform(x, [maxDrag * 0.7, maxDrag], [0, 1]);

  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  const [progressPercent, setProgressPercent] = useState(100);
  const totalBars = 14;
  const filledBars = Math.round((progressPercent / 100) * totalBars);

  useEffect(() => {
    if (!cycle) return;
    const { last, next } = cycle;
    const totalCycleMs = next.getTime() - last.getTime();

    const tick = () => {
      const now = new Date();
      const diff = next.getTime() - now.getTime();
      const elapsedMs = now.getTime() - last.getTime();
      const remaining = Math.max(0, Math.min(100, ((totalCycleMs - elapsedMs) / totalCycleMs) * 100));
      setProgressPercent(remaining);
      if (diff > 0) {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0 });
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bike.last_service_at, bike.next_service_at, bike.purchased_at]);

  const isUrgent = progressPercent < 20;
  const isCritical = progressPercent < 5 || countdown.days === 0;

  const getBarColor = (index: number) => {
    const isActive = index < filledBars;
    if (!isActive) return "bg-muted/30";
    if (isCritical) return "bg-destructive";
    if (isUrgent) return "bg-amber-500";
    return "bg-wj-green";
  };
  const getStatusColor = () => {
    if (isCritical) return "text-destructive";
    if (isUrgent) return "text-amber-500";
    return "text-wj-green";
  };

  const handleDragEnd = () => {
    const currentX = x.get();
    if (currentX >= maxDrag * 0.8) {
      animate(x, maxDrag, { duration: 0.2 });
      setTimeout(() => {
        onBook();
        // Reset slider back to the initial position after opening the modal
        animate(x, 0, { duration: 0.4, type: "spring", stiffness: 300, damping: 30 });
      }, 400);
    } else {
      animate(x, 0, { duration: 0.3, type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <div className="h-full p-6 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-2 h-2 rounded-full animate-pulse shrink-0", getStatusColor().replace("text-", "bg-"))} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {bike.model}
          </span>
        </div>
        <button
          onClick={onSetup}
          className="p-1.5 rounded-full bg-background/40 backdrop-blur-sm border border-border/40 hover:border-wj-green/50 transition-colors"
          aria-label="Edit service setup"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Body */}
      {needsSetup ? (
        <div className="flex-1 flex flex-col items-start justify-center gap-3">
          <p className="text-sm text-foreground/90 max-w-[260px]">
            Add the purchase date (or your last revision) and we'll set the 3-month cycle for you.
          </p>
          <button
            onClick={onSetup}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-wj-green text-background text-xs font-semibold shadow-lg shadow-wj-green/30 hover:bg-wj-green/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Set up service schedule
          </button>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Cycle: every 3 months
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-start justify-start pt-2">
          <div className="text-left mb-4">
            <div className="flex items-baseline gap-1">
              <span className={cn("text-5xl font-bold tracking-tight", getStatusColor())}>
                {countdown.days}
              </span>
              <span className="text-lg text-muted-foreground">d</span>
              <span className={cn("text-3xl font-bold ml-2", getStatusColor())}>
                {countdown.hours.toString().padStart(2, "0")}
              </span>
              <span className="text-sm text-muted-foreground">h</span>
              <span className={cn("text-3xl font-bold ml-2", getStatusColor())}>
                {countdown.minutes.toString().padStart(2, "0")}
              </span>
              <span className="text-sm text-muted-foreground">m</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">
              Until next service · {bike.services_completed} done
            </p>
            {cycle && (
              <p className="text-[10px] text-muted-foreground/80 mt-1">
                Due {cycle.next.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {cycle.fromPurchase ? " · estimated from purchase date" : " · 3 months after last revision"}
              </p>
            )}
          </div>

          <div className="w-full max-w-xs relative">
            <div className="flex gap-1 w-full">
              {Array.from({ length: totalBars }).map((_, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: 0.3 + index * 0.04 }}
                  className={cn(
                    "flex-1 h-6 rounded-md transition-colors duration-300 relative",
                    getBarColor(index)
                  )}
                >
                  {index === filledBars - 1 && filledBars > 0 && (
                    <span
                      className={cn(
                        "absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap",
                        getStatusColor()
                      )}
                    >
                      {Math.round(progressPercent)}%
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>Service Due</span>
              <span>Optimal</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer slider */}
      <div>
        {!needsSetup && (
          <motion.div
            ref={sliderTrackRef}
            style={{ backgroundColor }}
            className="relative h-14 rounded-full border border-wj-green/30 overflow-hidden"
          >
            <motion.div
              style={{ opacity: textOpacity }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-xs text-wj-green/70 font-medium tracking-wide">
                Slide to book service →
              </span>
            </motion.div>
            <motion.div
              style={{ opacity: checkOpacity }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <CheckCircle className="h-5 w-5 text-wj-green" />
            </motion.div>
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: maxDrag }}
              dragElastic={0}
              onDragEnd={handleDragEnd}
              style={{ x }}
              className="absolute left-1 top-1 bottom-1 w-12 rounded-full bg-wj-green flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg shadow-wj-green/30"
            >
              <ArrowRight className="h-5 w-5 text-background" />
            </motion.div>
          </motion.div>
        )}
      </div>

    </div>
  );
}