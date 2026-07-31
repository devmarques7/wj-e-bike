import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, Home, LogOut, Moon, Sun, Check, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDashboardNav, type DashboardNavItem } from "@/hooks/useDashboardNav";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Mobile floating pill nav, identical visual shell for every role.
 * Items come from the role-driven useDashboardNav() hook.
 */
export default function UnifiedFloatingNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = useDashboardNav();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();

  const isActive = (href: string) =>
    href === nav.homeHref
      ? location.pathname === href
      : location.pathname.startsWith(href);

  // First 2 primary items on the left, item index 2 on the right, rest in "More".
  const left = nav.primary.slice(0, 2);
  const rightItem = nav.primary[2];
  const more = [...nav.primary.slice(3), ...nav.more];

  return (
    <>
      <div className="lg:hidden h-24" />
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 220 }}
        className="lg:hidden fixed bottom-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4"
      >
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/40 bg-background/80 backdrop-blur-xl px-2 py-2 shadow-2xl shadow-black/30 max-w-[calc(100vw-2rem)]">
          {left.map((item) => (
            <NavBtn
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onClick={() => navigate(item.href)}
            />
          ))}

          {/* Center home pill */}
          <button
            onClick={() => navigate(nav.homeHref)}
            className="relative -my-3 mx-1 flex h-12 w-12 items-center justify-center rounded-full bg-wj-green text-primary-foreground shadow-lg shadow-wj-green/40 active:scale-95 transition-transform"
            aria-label="Home"
          >
            <Home className="h-5 w-5" />
            <motion.span
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-wj-green/30"
            />
          </button>

          {rightItem && (
            <NavBtn
              item={rightItem}
              active={isActive(rightItem.href)}
              onClick={() => navigate(rightItem.href)}
            />
          )}

          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-95",
                    "hover:text-foreground hover:bg-muted/50",
                  )}
                  aria-label="More"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="mb-2 w-52">
                {more.length > 0 && <DropdownMenuLabel>More</DropdownMenuLabel>}
                {more.map((m) => (
                  <DropdownMenuItem
                    key={m.href}
                    onClick={() => navigate(m.href)}
                    className="gap-2"
                  >
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </DropdownMenuItem>
                ))}
                {more.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setTheme("light");
                  }}
                  className="gap-2"
                >
                  <Sun className="h-4 w-4" />
                  Light mode
                  {theme === "light" && <Check className="ml-auto h-4 w-4 text-wj-green" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setTheme("dark");
                  }}
                  className="gap-2"
                >
                  <Moon className="h-4 w-4" />
                  Dark mode
                  {theme === "dark" && <Check className="ml-auto h-4 w-4 text-wj-green" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Back to site
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async (e) => {
                    e.preventDefault();
                    await logout();
                    navigate("/auth", { replace: true });
                  }}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.nav>
    </>
  );
}

function NavBtn({
  item,
  active,
  onClick,
}: {
  item: DashboardNavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all active:scale-95",
        active ? "bg-wj-green/15 text-wj-green" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {active && <span className="hidden xs:inline sm:inline">{item.label}</span>}
    </button>
  );
}