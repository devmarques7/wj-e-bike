import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Phone, MapPin, Truck, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";

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
    href: "tel:+31201234567"
  },
  {
    icon: Truck,
    label: "Request Pickup",
    description: "We'll come to you and pick up your bike",
    action: "Schedule Now",
    href: null
  },
  {
    icon: MapPin,
    label: "Find Us",
    description: "Visit your nearest service center",
    action: "View Locations",
    href: "/find-store"
  }
];

export default function UrgentService() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [pickupRequested, setPickupRequested] = useState(false);

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
                className="w-full p-4 rounded-2xl border border-wj-green/20 bg-wj-green/5 hover:bg-wj-green/10 hover:border-wj-green/40 transition-all duration-300 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-wj-green/10 flex items-center justify-center group-hover:bg-wj-green/20 transition-colors">
                  <option.icon className="h-5 w-5 text-wj-green" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <span className="text-xs text-wj-green font-medium">
                  {option.label === "Request Pickup" && pickupRequested ? "Requested ✓" : option.action}
                </span>
              </motion.button>
            ))}
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
    </RoleDashboardLayout>
  );
}
