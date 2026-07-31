import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, Wrench, Calendar, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard/staff" },
  { icon: Wrench, label: "Tasks", href: "/dashboard/staff/tasks" },
  { icon: Calendar, label: "Schedule", href: "/dashboard/staff/schedule" },
  { icon: User, label: "Profile", href: "/dashboard/staff/profile" },
];

export default function StaffFooterNav() {
  const location = useLocation();

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "text-wj-green"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-wj-green")} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="staffActiveTab"
                  className="absolute -bottom-0 w-8 h-0.5 bg-wj-green rounded-full"
                />
              )}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
