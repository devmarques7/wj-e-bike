import { useMemo } from "react";
import {
  LayoutDashboard,
  Wrench,
  Calendar,
  CreditCard,
  Users,
  Package,
  Contact,
  Bike,
  Warehouse,
  Heart,
  Crown,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useAuth, type UserRole } from "@/contexts/AuthContext";

export type DashboardNavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
};

export type DashboardNavConfig = {
  role: UserRole;
  brand: { prefix: string; suffix: string };
  roleLabel: string;
  /** Items shown in the desktop header / primary list */
  primary: DashboardNavItem[];
  /** Items shown in the "More" mobile dropdown (optional) */
  more: DashboardNavItem[];
  /** Default home route for this role */
  homeHref: string;
  /** Settings route (used by user dropdown) */
  settingsHref: string;
};

const CUSTOMER_CONFIG: DashboardNavConfig = {
  role: "customer",
  brand: { prefix: "WJ", suffix: " VISION" },
  roleLabel: "Member",
  homeHref: "/dashboard",
  settingsHref: "/dashboard/settings",
  primary: [
    { icon: LayoutDashboard, label: "Overview",  href: "/dashboard" },
    { icon: CreditCard,      label: "E-Pass",    href: "/dashboard/e-pass" },
    { icon: Warehouse,       label: "Garage",    href: "/dashboard/garage" },
    { icon: Heart,           label: "Favorites", href: "/dashboard/favorites" },
    { icon: Bike,            label: "Bike",      href: "/dashboard/bike" },
    { icon: Crown,           label: "Membership", href: "/dashboard/membership" },
  ],
  more: [],
};

const CONFIG: Record<UserRole, DashboardNavConfig> = {
  guest: CUSTOMER_CONFIG,
  customer: CUSTOMER_CONFIG,
  admin: {
    role: "admin",
    brand: { prefix: "WJ", suffix: " COMMAND" },
    roleLabel: "Admin",
    homeHref: "/dashboard/admin",
    settingsHref: "/dashboard/admin/settings",
    primary: [
      { icon: LayoutDashboard, label: "Overview",  href: "/dashboard/admin" },
      { icon: Wrench,          label: "Workshop",  href: "/dashboard/admin/workshop" },
      { icon: Calendar,        label: "Manage",    href: "/dashboard/admin/manage" },
      { icon: CreditCard,      label: "Plans",     href: "/dashboard/admin/plans" },
      { icon: Users,           label: "Staff",     href: "/dashboard/admin/members" },
      { icon: Package,         label: "Inventory", href: "/dashboard/admin/inventory" },
      { icon: Contact,         label: "CRM",       href: "/dashboard/admin/crm" },
    ],
    more: [
      { icon: Settings, label: "Settings", href: "/dashboard/admin/settings" },
    ],
  },
  staff: {
    role: "staff",
    brand: { prefix: "WJ", suffix: " WORKSHOP" },
    roleLabel: "Staff",
    homeHref: "/dashboard/staff",
    settingsHref: "/dashboard/staff/profile",
    primary: [
      { icon: LayoutDashboard, label: "Overview", href: "/dashboard/staff" },
      { icon: Wrench,          label: "Garage",   href: "/dashboard/staff/garage" },
      { icon: Calendar,        label: "Manage",   href: "/dashboard/staff/schedule" },
    ],
    more: [],
  },
};

/**
 * Central role-driven dashboard nav config.
 * Every dashboard chrome component (header, footer nav, sidebar, etc.) should
 * consume this hook instead of hard-coding role-specific routes.
 */
export function useDashboardNav(roleOverride?: UserRole): DashboardNavConfig {
  const { user } = useAuth();
  const role: UserRole = roleOverride ?? user?.role ?? "customer";
  return useMemo(() => CONFIG[role] ?? CUSTOMER_CONFIG, [role]);
}