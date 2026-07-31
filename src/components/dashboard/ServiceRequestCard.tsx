import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, CheckCircle, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { MeshGradient } from "@paper-design/shaders-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import EmptyState from "./EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";


interface ServiceRequestCardProps {
  /** Bike selected by the page-level BikeTabs selector. */
  bike?: { id: string; model: string; serial: string | null } | null;
}

export default function ServiceRequestCard({ bike }: ServiceRequestCardProps = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isCompleted, setIsCompleted] = useState(false);

  const [videoOpacity, setVideoOpacity] = useState(1);
  const [planLoading, setPlanLoading] = useState(true);
  const [hasUrgentService, setHasUrgentService] = useState(false);
  const [planName, setPlanName] = useState<string>("");
  const [urgentFee, setUrgentFee] = useState<number>(0);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<number>(0);
  const [emergencyServiceId, setEmergencyServiceId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(240);

  // When the user has no linked bike, the card becomes a "FAQ shortcut":
  // same visual as the urgent slider, but the swipe just routes to the
  // urgent-service FAQ page (no appointment is created).
  const faqMode = !bike && !user?.bikeId;
  
  const x = useMotionValue(0);
  // Track width is measured so the thumb can always travel to the very end.
  const maxDrag = Math.max(0, trackWidth - 48 - 8);

  useEffect(() => {
    const el = constraintsRef.current;
    if (!el) return;
    const update = () => setTrackWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const progress = useTransform(x, (v) => (maxDrag > 0 ? v / maxDrag : 0));
  const backgroundColor = useTransform(
    progress,
    [0, 1],
    ["rgba(5, 140, 66, 0.1)", "rgba(5, 140, 66, 0.3)"]
  );
  const textOpacity = useTransform(progress, [0, 0.5], [1, 0]);
  const checkOpacity = useTransform(progress, [0.7, 1], [0, 1]);

  // Resolve user's plan and check if urgent service is included.
  // Heuristic: tier_level >= 2 (Plus/Black) OR features mention urgent/priority/unlimited/same-day/concierge.
  useEffect(() => {
    if (!user) {
      setPlanLoading(false);
      return;
    }
    // Demo users: derive from tier
    if (user.isDemo) {
      const tier = (user.tier || "free").toLowerCase();
      setPlanName(tier.toUpperCase());
      setHasUrgentService(true); // All plans now include urgent service (with fee for lower tiers)
      setUrgentFee(tier === "plus" || tier === "black" ? 0 : 100);
      setPlanLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, plan_versions:plan_version_id(features, urgent_service_included, urgent_service_fee, plans:plan_id(slug, name, tier_level))")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      const row: any = data?.[0];
      const plan = row?.plan_versions?.plans;
      const tier = Number(plan?.tier_level ?? 0);
      const included = row?.plan_versions?.urgent_service_included !== false;
      const fee = Number(row?.plan_versions?.urgent_service_fee ?? 0);
      if (!cancelled) {
        setPlanName(plan?.name || (plan?.slug ? String(plan.slug).toUpperCase() : "FREE"));
        setHasUrgentService(included);
        setUrgentFee(fee);
        setSubscriptionId(row?.id ?? null);
        setPlanTier(tier);
        setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.isDemo, user?.tier]);

  // Load emergency service type once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("service_types")
        .select("id")
        .eq("is_active", true)
        .or("slug.eq.emergency,is_emergency.eq.true")
        .limit(1);
      if (!cancelled) setEmergencyServiceId(data?.[0]?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  // Smooth video loop transition with fade
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!video.duration) return;
      const timeLeft = video.duration - video.currentTime;
      
      // Start fading out 1 second before video ends
      if (timeLeft <= 1 && timeLeft > 0) {
        const fadeProgress = 1 - timeLeft; // 0 to 1
        setVideoOpacity(1 - fadeProgress * 0.5); // Fade to 0.5 opacity
      }
    };

    const handleEnded = () => {
      // Reset to beginning
      video.currentTime = 0;
      video.play();
      
      // Fade back in smoothly
      setVideoOpacity(0.5);
      requestAnimationFrame(() => {
        setVideoOpacity(1);
      });
    };

    // Ensure video plays on mount
    video.play().catch(() => {});

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  const handleDragEnd = () => {
    const currentX = x.get();
    if (currentX >= maxDrag * 0.8) {
      animate(x, maxDrag, { duration: 0.2 });
      if (faqMode) {
        setIsCompleted(true);
        setTimeout(() => navigate("/dashboard/urgent-service"), 300);
      } else {
        setConfirmOpen(true);
      }
    } else {
      animate(x, 0, { duration: 0.3, type: "spring", stiffness: 400, damping: 30 });
    }
  };

  const resetSlider = () => {
    setIsCompleted(false);
    animate(x, 0, { duration: 0.3 });
  };

  const submitUrgentRequest = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const fee = urgentFee || 0;
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      const hh = String(today.getHours()).padStart(2, "0");
      const mm = String(today.getMinutes()).padStart(2, "0");
      const startTime = `${hh}:${mm}:00`;

      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        service_type_id: emergencyServiceId,
        subscription_id: subscriptionId,
        subscription_plan_level: planTier,
        is_covered_by_plan: fee === 0,
        extra_charge_eur: fee,
        scheduled_date: dateStr,
        scheduled_start_time: startTime,
        duration_minutes: 60,
        status: "pending",
        priority: "emergency",
        priority_score: 100,
        booked_via: "portal",
        notes: bike
          ? `Urgent service requested from dashboard · ${bike.model}${bike.serial ? ` (${bike.serial})` : ""}`
          : "Urgent service requested from dashboard",
      } as any);
      if (error) throw error;
      setIsCompleted(true);
      toast({
        title: "Urgent request sent",
        description: fee > 0
          ? `Our team will contact you shortly. A €${fee.toFixed(2)} fee applies.`
          : "Our team will contact you shortly.",
      });
      setConfirmOpen(false);
      setTimeout(() => navigate("/dashboard/urgent-service"), 600);
    } catch (e: any) {
      toast({
        title: "Could not send request",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
      resetSlider();
    } finally {
      setSubmitting(false);
    }
  };

  // Plan does not include urgent service → show locked state with upgrade CTA.
  if (!faqMode && !planLoading && !hasUrgentService) {
    return (
      <div className="h-full relative">
        <div className="h-full rounded-3xl overflow-hidden border border-border/40 bg-card/30 backdrop-blur-md p-6 flex flex-col justify-between min-h-[180px]">
          <div>
            <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center mb-4 border border-border/40">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Urgent Service
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Not included in your {planName || "current"} plan. Upgrade to unlock immediate assistance.
            </p>
          </div>
          <Link
            to="/dashboard/wallet"
            className="mt-4 h-12 rounded-full border border-wj-green/30 bg-wj-green/10 hover:bg-wj-green/20 transition-colors flex items-center justify-center text-xs font-medium text-wj-green tracking-wide"
          >
            Upgrade plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative group">
      {/* Animated Gradient Border */}
      <div className="absolute -inset-[1px] rounded-3xl overflow-hidden">
        <motion.div
          className="absolute -inset-[100%] w-[300%] h-[300%]"
          style={{
            background: "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 60deg, hsl(var(--wj-green) / 0.8) 120deg, hsl(var(--wj-green)) 180deg, hsl(var(--wj-green) / 0.8) 240deg, transparent 300deg, transparent 360deg)",
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
      
      {/* Inner Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative h-full rounded-3xl overflow-hidden bg-background"
      >
        {/* Shader Background */}
        <ShaderBackground className="absolute inset-0 w-full h-full block" />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />
        
        {/* Content */}
        <div className="relative z-10 h-full p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {faqMode ? "Urgent Help" : "Urgent Service"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {faqMode
                ? "Link a bike or browse the urgent service FAQ."
                : "Need immediate assistance?"}
            </p>
          </div>

          {/* Swipe Slider */}
          <div className="mt-4">
            <motion.div
              ref={constraintsRef}
              style={{ backgroundColor }}
              className="relative h-14 rounded-full border border-wj-green/30 overflow-hidden"
            >
              {/* Hint Text */}
              <motion.div 
                style={{ opacity: textOpacity }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <span className="text-xs text-wj-green/70 font-medium tracking-wide">
                  {faqMode ? "Slide for Urgency" : "Slide to request"}
                </span>
              </motion.div>
              
              {/* Success Check */}
              <motion.div 
                style={{ opacity: checkOpacity }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <CheckCircle className="h-5 w-5 text-wj-green" />
              </motion.div>

              {/* Draggable Thumb */}
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
          </div>
        </div>
      </motion.div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o && !isCompleted) resetSlider();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-wj-green/15 border border-wj-green/30 flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-wj-green" />
            </div>
            <DialogTitle>Confirm urgent request</DialogTitle>
            <DialogDescription>
              Our team will be notified immediately and contact you to arrange assistance.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium text-foreground">{planName || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Urgent fee</span>
              <span className="font-semibold text-foreground">
                {urgentFee > 0 ? `€${urgentFee.toFixed(2)}` : "Included"}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setConfirmOpen(false); resetSlider(); }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitUrgentRequest}
              disabled={submitting}
              className="bg-wj-green hover:bg-wj-green/90 text-background"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
