import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, Bike, Wrench, Heart, Crown, CreditCard, LayoutGrid, Settings, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Overview" },
  { href: "/dashboard/v-id", icon: CreditCard, label: "V-ID" },
  { href: "/dashboard/bike", icon: Bike, label: "Bike" },
  { href: "/dashboard/garage", icon: Wrench, label: "Service" },
  { href: "/dashboard/favorites", icon: Heart, label: "Favorites" },
  { href: "/dashboard/membership", icon: Crown, label: "Membership" },
];

export default function DashboardHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="p-4">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl"
      >
        <div className="flex items-center justify-between h-14 px-6">
          {/* Left - Company Name */}
          <Link to="/" className="flex items-center gap-1">
            <span className="text-lg font-bold tracking-wider">
              <span className="text-foreground">WJ</span>
              <span className="text-wj-green"> VISION</span>
            </span>
          </Link>

          {/* Center - Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300",
                    isActive
                      ? "bg-wj-green/10 text-wj-green"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <motion.span
                    initial={false}
                    animate={{
                      width: isActive ? "auto" : 0,
                      opacity: isActive ? 1 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-medium overflow-hidden whitespace-nowrap"
                  >
                    {isActive && item.label}
                  </motion.span>
                </Link>
              );
            })}
          </nav>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Search className="h-5 w-5" />
            </button>
            <button className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-wj-green rounded-full" />
            </button>
            
            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none">
                  <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-wj-green/50 transition-all">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="bg-wj-green/10 text-wj-green text-sm font-medium">
                      {user?.name ? getInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-card border border-border/50 shadow-xl z-50"
              >
                <div className="px-3 py-2 border-b border-border/50">
                  <p className="text-sm font-medium text-foreground">{user?.name || "Guest"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || "guest@example.com"}</p>
                </div>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/dashboard/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.header>
    </div>
  );
}
