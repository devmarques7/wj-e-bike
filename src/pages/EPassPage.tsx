import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import BikeShowcase from "@/components/dashboard/BikeShowcase";
import WalletCardStack from "@/components/dashboard/WalletCardStack";
import { useAuth } from "@/contexts/AuthContext";

export default function EPassPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  if (authLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/dashboard/admin" replace />;
  }

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-2"
        >
          <h1 className="text-xl sm:text-2xl font-light text-foreground">E-Pass</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your digital identity & membership cards
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-12 gap-4 lg:gap-6"
        >
          {/* Bike Showcase - 7 columns */}
          <div className="col-span-12 lg:col-span-7">
            <BikeShowcase />
          </div>

          {/* Apple Wallet style card stack - 5 columns */}
          <div className="col-span-12 lg:col-span-5">
            <WalletCardStack />
          </div>
        </motion.div>
      </div>
    </RoleDashboardLayout>
  );
}
