import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, Search, ChevronLeft, Wrench, Calendar, MessageSquare, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard/staff" },
  { icon: Wrench, label: "My Tasks", href: "/dashboard/staff/tasks" },
  { icon: Calendar, label: "Schedule", href: "/dashboard/staff/schedule" },
];

export default function StaffHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="m-4 mb-0 px-6 py-4 bg-background/60 backdrop-blur-xl border border-border/30 rounded-2xl"
    >
      <div className="flex items-center justify-between">
        {/* Left: Logo & Back */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-wj-green transition-colors" />
            <span className="text-lg font-bold tracking-wider">
              <span className="text-foreground">WJ</span>
              <span className="text-wj-green"> WORKSHOP</span>
            </span>
          </Link>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-wj-green/10 text-wj-green"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className={cn("text-sm font-medium", !isActive && "hidden xl:inline")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Search className="h-5 w-5" />
          </button>

          {/* Notifications */}
          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-wj-green rounded-full" />
          </button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-muted/50 hover:bg-muted transition-colors">
                <div className="w-8 h-8 rounded-full bg-wj-green/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-wj-green">
                    {user?.name?.charAt(0) || "S"}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground hidden sm:inline">
                  {user?.name?.split(" ")[0] || "Staff"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/profile">My Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
}
