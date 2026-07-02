import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Phone, MapPin, Truck, AlertTriangle, Zap } from "lucide-react";
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
    icon: Zap,
    label: "Repair Now",
    description: "Skip the line — you must be on-site",
    action: "€100 fee",
    href: null as string | null,
    variant: "urgent" as const,
  },
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

export default function UrgentService() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [pickupRequested, setPickupRequested] = useState(false);
  const [repairNowOpen, setRepairNowOpen] = useState(false);
  const [repairNowConfirmed, setRepairNowConfirmed] = useState(false);

  const handleContactAction = (option: typeof contactOptions[0]) => {
    if (option.label === "Repair Now") {
      setRepairNowOpen(true);
      return;
    }
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
