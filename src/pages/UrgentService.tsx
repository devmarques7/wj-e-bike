import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Phone, MapPin, Truck, AlertTriangle, Zap, Loader2, ShieldCheck, LocateFixed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import PickItUpMap from "@/components/dashboard/PickItUpMap";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const faqs = [
  {
    q: "What qualifies as an urgent service?",
    a: "Urgent services include brake failures, electrical malfunctions, battery issues that prevent riding, or any safety-critical problems."
  },
  {
    q: "How quickly can I get help?",
    a: "Our emergency response team typically arrives within 2-4 hours in urban areas. Remote locations may take longer."
  },
  {
    q: "Is there an extra fee for urgent service?",
    a: "Urgent service requests outside business hours may incur an additional fee. Members with Premium plans get priority support at no extra cost."
  },
  {
    q: "What should I do while waiting?",
    a: "Ensure your bike is in a safe location, note any error codes on the display, and have your VID ready for the technician."
  },
  {
    q: "Can I get a replacement bike?",
    a: "Yes, depending on availability. Request a pickup and we'll arrange a temporary replacement if your repair takes more than 24 hours."
  }
];

const contactOptions = [
  {
    icon: Phone,
    label: "Call Us",
    description: "Speak directly with our support team",
    action: "+31 20 123 4567",
    href: "tel:+31201234567",
    variant: "default" as const,
  },
  {
    icon: Truck,
    label: "Request Pickup",
    description: "We'll come to you and pick up your bike",
    action: "Schedule Now",
    href: null as string | null,
    variant: "default" as const,
  },
  {
    icon: MapPin,
    label: "Find Us",
    description: "Visit your nearest service center",
    action: "View Locations",
    href: "/find-store",
    variant: "default" as const,
  }
];

// WJ Headquarters — Stammerdijk 1f, 1112 AA Diemen
const HQ_COORDS = { lat: 52.3385, lng: 4.9530 };
const ON_SITE_RADIUS_M = 150;
const REPAIR_NOW_FEE = 100;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function UrgentService() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [pickupRequested, setPickupRequested] = useState(false);
  const [repairNowOpen, setRepairNowOpen] = useState(false);
  const [repairNowConfirmed, setRepairNowConfirmed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [onSite, setOnSite] = useState(false);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const handleContactAction = (option: typeof contactOptions[0]) => {
    if (option.href) {
      if (option.href.startsWith("tel:")) {
        window.location.href = option.href;
      } else {
        navigate(option.href);
      }
    } else {
      setPickupRequested(true);
      setTimeout(() => setPickupRequested(false), 3000);
    }
  };

  const analyzeLocation = () => {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation is not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = haversineMeters(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          HQ_COORDS,
        );
        setDistanceM(d);
        const here = d <= ON_SITE_RADIUS_M;
        setOnSite(here);
        setLocating(false);
        if (here) {
          toast.success("On-site verified — Repair Now unlocked.");
        } else {
          toast.error("You're not at the workshop.", {
            description: `You are ~${Math.round(d)}m from WJ HQ. Get within ${ON_SITE_RADIUS_M}m to unlock.`,
          });
        }
      },
      (err) => {
        setLocating(false);
        setLocError(err.message || "Unable to read your location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const confirmRepairNow = () => {
    setRepairNowOpen(false);
    setRepairNowConfirmed(true);
    toast.success("You're in the on-site repair queue. A mechanic will call you shortly.", {
      description: "€100 extra-maintenance fee will be added to your account.",
    });
    setTimeout(() => setRepairNowConfirmed(false), 5000);
  };

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Page header — matches the rest of the dashboard sub-pages */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-wj-green/15 border border-wj-green/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-wj-green" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                Urgent Service
              </h1>
              <p className="text-xs text-muted-foreground">Get immediate assistance</p>
            </div>
          </div>

          {/* Contact Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h2 className="text-xs uppercase tracking-[0.2em] text-wj-green font-medium mb-4">
              Quick Actions
            </h2>
            
            {contactOptions.map((option, index) => (
              <motion.button
                key={option.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleContactAction(option)}
                className={`relative w-full p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 group overflow-hidden ${
                  option.variant === "urgent"
                    ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/60"
                    : "border-wj-green/20 bg-wj-green/5 hover:bg-wj-green/10 hover:border-wj-green/40"
                }`}
              >
                {option.variant === "urgent" && (
                  <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> On-site only
                  </span>
                )}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    option.variant === "urgent"
                      ? "bg-red-500/10 group-hover:bg-red-500/20"
                      : "bg-wj-green/10 group-hover:bg-wj-green/20"
                  }`}
                >
                  <option.icon
                    className={`h-5 w-5 ${option.variant === "urgent" ? "text-red-400" : "text-wj-green"}`}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <span
                  className={`text-xs font-medium ${
                    option.variant === "urgent" ? "text-red-400" : "text-wj-green"
                  }`}
                >
                  {option.label === "Request Pickup" && pickupRequested
                    ? "Requested ✓"
                    : option.label === "Repair Now" && repairNowConfirmed
                    ? "In queue ✓"
                    : option.action}
                </span>
              </motion.button>
            ))}
          </motion.div>

          {/* On-site Repair Now — gated by geolocation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="pt-2"
          >
            <h2 className="text-xs uppercase tracking-[0.2em] text-red-400 font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> On-site only
            </h2>

            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Repair Now</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You must be physically present at the workshop to access this tool.
                  </p>
                </div>
                {onSite && (
                  <span className="text-xs font-medium text-red-400 shrink-0">
                    €{REPAIR_NOW_FEE} fee
                  </span>
                )}
              </div>

              <ul className="text-[11px] text-muted-foreground space-y-1.5 pl-1">
                <li className="flex gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                  Skips the queue — an extra-maintenance fee of €{REPAIR_NOW_FEE} will be charged.
                </li>
                <li className="flex gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                  Only available within {ON_SITE_RADIUS_M}m of WJ Headquarters (Stammerdijk 1f, Diemen).
                </li>
                <li className="flex gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                  Location permission is required to unlock this action.
                </li>
              </ul>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={analyzeLocation}
                  disabled={locating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-wj-green/30 bg-wj-green/10 hover:bg-wj-green/20 text-sm text-wj-green transition-colors disabled:opacity-60"
                >
                  {locating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing location…</>
                  ) : onSite ? (
                    <><ShieldCheck className="h-4 w-4" /> On-site verified</>
                  ) : (
                    <><LocateFixed className="h-4 w-4" /> Analyze location</>
                  )}
                </button>
                <button
                  onClick={() => setRepairNowOpen(true)}
                  disabled={!onSite}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400"
                >
                  <Zap className="h-4 w-4" />
                  {repairNowConfirmed ? "In queue ✓" : `Repair Now · €${REPAIR_NOW_FEE}`}
                </button>
              </div>

              {locError && (
                <p className="text-[11px] text-red-400">{locError}</p>
              )}
              {distanceM !== null && !onSite && !locError && (
                <p className="text-[11px] text-muted-foreground">
                  You are ~{Math.round(distanceM)}m from WJ HQ. Get within {ON_SITE_RADIUS_M}m to unlock Repair Now.
                </p>
              )}
            </div>
          </motion.div>

          {/* Pick-It-Up Places Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <PickItUpMap />
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="pt-6"
          >
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-2">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="border border-border/20 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
                  >
                    <span className="text-sm text-foreground pr-4">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                        expandedFaq === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {expandedFaq === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 text-sm text-muted-foreground">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <AlertDialog open={repairNowOpen} onOpenChange={setRepairNowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Confirm on-site repair
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <strong className="text-foreground">You must already be at one of our workshops</strong> to
                use Repair Now. A mechanic will jump on your bike as soon as one is free.
              </span>
              <span className="block text-red-400">
                This action has an extra-maintenance fee of <strong>€100</strong>.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRepairNow}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              I'm on-site — start now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  );
}
