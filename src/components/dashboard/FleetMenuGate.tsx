import { useLocation } from "react-router-dom";
import FleetMenu from "@/components/dashboard/FleetMenu";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Mounts the Fleet dial on every staff and admin dashboard page.
 * Admins get the dial without the shift toggle; customers never see it.
 */
export default function FleetMenuGate() {
  const { pathname } = useLocation();
  const { user, isAuthenticated } = useAuth();

  const onStaffArea = pathname.startsWith("/dashboard/staff");
  const onAdminArea = pathname.startsWith("/dashboard/admin");
  if (!isAuthenticated || (!onStaffArea && !onAdminArea)) return null;

  const role = user?.role;
  if (role !== "staff" && role !== "admin") return null;

  return <FleetMenu showShift={role === "staff" && onStaffArea} />;
}
