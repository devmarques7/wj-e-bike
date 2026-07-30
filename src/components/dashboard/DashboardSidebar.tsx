import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Bike,
  Calendar,
  Wrench,
  Heart,
  Settings,
  LogOut,
  Crown,
  Shield,
  ChevronLeft,
} from "lucide-react";
import { useAuth, MemberTier } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  tier?: MemberTier[];
}

const memberNavItems: NavItem[] = [
  { icon: Home, label: "Overview", href: "/dashboard" },
  { icon: Bike, label: "My Bike", href: "/dashboard/bike" },
  { icon: Wrench, label: "Maintenance", href: "/dashboard/maintenance" },
  { icon: Heart, label: "Favorites", href: "/dashboard/favorites" },
  { icon: Crown, label: "VIP Concierge", href: "/dashboard/concierge", tier: ["black"] },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const tierColors: Record<MemberTier, string> = {
  light: "bg-muted text-muted-foreground",
  plus: "bg-wj-green/20 text-wj-green",
  black: "bg-foreground text-background",
};

const tierLabels: Record<MemberTier, string> = {
  light: "Light",
  plus: "Plus",
  black: "Black",
};

export default function DashboardSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const filteredNavItems = memberNavItems.filter((item) => {
    if (!item.tier) return true;
    return user?.tier && item.tier.includes(user.tier);
  });

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-64 min-h-screen bg-card border-r border-border/50 flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-border/30">
        <Link to="/" className="flex items-center gap-2 group">
          <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-wj-green transition-colors" />
          <span className="text-lg font-bold tracking-wider">
            <span className="text-foreground">WJ</span>
            <span className="text-wj-green"> VISION</span>
          </span>
        </Link>
      </div>

      {/* User Info */}
      <div className="p-6 border-b border-border/30">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar}
            alt={user?.name}
            className="w-10 h-10 rounded-full bg-muted"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{user?.name}</p>
            <div className="flex items-center gap-2 mt-1">
              {user?.tier && (
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", tierColors[user.tier])}>
                  {tierLabels[user.tier]}
                </span>
              )}
              <span className="text-xs text-muted-foreground">Member</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-wj-green/10 text-wj-green"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.tier?.includes("black") && (
                    <Shield className="h-3 w-3 ml-auto text-wj-green" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border/30">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </motion.aside>
  );
}
