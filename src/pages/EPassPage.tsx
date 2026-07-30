import { Navigate } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function EPassPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  if (authLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6" />
    </RoleDashboardLayout>
  );
}

