import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Bike,
  Calendar,
  Wrench,
  Heart,
  Crown,
  CreditCard,
  X,
} from "lucide-react";
import { useAuth, MemberTier } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  tier?: MemberTier[];
}

// Menu items without Settings
const menuNavItems: NavItem[] = [
  { icon: CreditCard, label: "V-ID", href: "/dashboard" },
  { icon: Bike, label: "Bike", href: "/dashboard/bike" },
  { icon: Calendar, label: "Service", href: "/dashboard/garage" },
  { icon: Wrench, label: "Care", href: "/dashboard/maintenance" },
  { icon: Heart, label: "Favorites", href: "/dashboard/favorites" },
  { icon: Crown, label: "VIP", href: "/dashboard/concierge", tier: ["black"] },
];

export default function MobileFooterNav() {
  const [showAllMenu, setShowAllMenu] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const filteredNavItems = menuNavItems.filter((item) => {
    if (!item.tier) return true;
    return user?.tier && item.tier.includes(user.tier);
  });

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    if (href === "/dashboard/bike") {
      return location.pathname === "/dashboard/bike";
    }
    return location.pathname === href;
  };

  return (
    <>
      {/* Spacer */}
      <div className="lg:hidden h-24" />

      {/* Footer Navigation - Minimalist Full Width Arc */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="relative">
          {/* Arc Background */}
          <svg
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 w-full h-16"
          >
            <path
              d="M0,20 Q50,0 100,20 L100,20 L0,20 Z"
              className="fill-card"
            />
          </svg>
          
          {/* Arc border glow */}
          <svg
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 w-full h-16"
          >
            <path
              d="M0,20 Q50,0 100,20"
              fill="none"
              className="stroke-wj-green/30"
              strokeWidth="0.3"
            />
          </svg>

          {/* Navigation Icons - 3 items inline */}
          <div className="relative flex items-end justify-center gap-8 pb-4 pt-1">
            <Link to="/dashboard" className="relative z-10 -mb-1">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isActive("/dashboard")
                    ? "bg-wj-green text-primary-foreground shadow-lg shadow-wj-green/30"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <CreditCard className="h-4 w-4" />
              </motion.div>
              <span className={cn(
                "absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-medium whitespace-nowrap",
                isActive("/dashboard") ? "text-wj-green" : "text-muted-foreground"
              )}>
                V-ID
              </span>
            </Link>

            <button
              onClick={() => setShowAllMenu(true)}
              className="relative z-10 -mt-8"
            >
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-wj-green flex items-center justify-center shadow-xl shadow-wj-green/40"
              >
                <motion.div
                  animate={{ rotate: showAllMenu ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Home className="h-6 w-6 text-primary-foreground" />
                </motion.div>
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-wj-green/20"
              />
            </button>

            <Link to="/dashboard/garage" className="relative z-10 -mb-1">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isActive("/dashboard/garage")
                    ? "bg-wj-green text-primary-foreground shadow-lg shadow-wj-green/30"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Calendar className="h-4 w-4" />
              </motion.div>
              <span className={cn(
                "absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-medium whitespace-nowrap",
                isActive("/dashboard/garage") ? "text-wj-green" : "text-muted-foreground"
              )}>
                Service
              </span>
            </Link>
          </div>

          <div className="h-4 bg-card" />
        </div>
      </div>

      {/* Expanded Menu - Same Layout Style */}
      <AnimatePresence>
        {showAllMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllMenu(false)}
              className="lg:hidden fixed inset-0 bg-background/60 backdrop-blur-md z-50"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
            >
              <div className="relative">
                {/* Arc Background - Same style as closed state */}
                <svg
                  viewBox="0 0 100 20"
                  preserveAspectRatio="none"
                  className="absolute bottom-0 left-0 w-full h-24"
                >
                  <path
                    d="M0,20 Q50,0 100,20 L100,20 L0,20 Z"
                    className="fill-card"
                  />
                </svg>
                
                {/* Arc border */}
                <svg
                  viewBox="0 0 100 20"
                  preserveAspectRatio="none"
                  className="absolute bottom-0 left-0 w-full h-24"
                >
                  <path
                    d="M0,20 Q50,0 100,20"
                    fill="none"
                    className="stroke-wj-green/30"
                    strokeWidth="0.3"
                  />
                </svg>

                {/* All Items Inline - Same layout as default */}
                <div className="relative flex items-end justify-center gap-3 pb-5 pt-2 px-4">
                  {filteredNavItems.map((item, index) => {
                    const isItemActive = isActive(item.href);
                    const isCenter = index === Math.floor(filteredNavItems.length / 2);
                    
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ delay: index * 0.03, duration: 0.2 }}
                      >
                        <Link
                          to={item.href}
                          onClick={() => setShowAllMenu(false)}
                          className={cn(
                            "relative z-10 flex flex-col items-center",
                            isCenter ? "-mt-6" : "-mb-1"
                          )}
                        >
                          <motion.div
                            whileTap={{ scale: 0.9 }}
                            className={cn(
                              "rounded-full flex items-center justify-center transition-all duration-300",
                              isCenter ? "w-12 h-12" : "w-10 h-10",
                              isItemActive
                                ? "bg-wj-green text-primary-foreground shadow-lg shadow-wj-green/30"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <item.icon className={cn(isCenter ? "h-5 w-5" : "h-4 w-4")} />
                          </motion.div>
                          <span
                            className={cn(
                              "absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-medium whitespace-nowrap",
                              isItemActive ? "text-wj-green" : "text-muted-foreground"
                            )}
                          >
                            {item.label}
                          </span>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Safe area */}
                <div className="h-4 bg-card" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
