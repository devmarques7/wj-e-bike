import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SystemStatusProvider } from "@/hooks/useSystemStatus";
import Index from "./pages/Index";
import Gallery from "./pages/Gallery";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import MembershipPlans from "./pages/MembershipPlans";
import Accessories from "./pages/Accessories";
import AccessoryDetail from "./pages/AccessoryDetail";
import FindStore from "./pages/FindStore";
import BookTestRide from "./pages/BookTestRide";
import OurStory from "./pages/OurStory";
import Career from "./pages/Career";
import Help from "./pages/Help";
import Delivery from "./pages/Delivery";
import Returns from "./pages/Returns";
import Auth from "./pages/Auth";
import CompleteProfile from "./pages/CompleteProfile";
import Dashboard from "./pages/Dashboard";
import ServiceDashboard from "./pages/ServiceDashboard";
import BikeCatalog from "./pages/dashboard/BikeCatalog";
import Membership from "./pages/dashboard/Membership";
import Favorites from "./pages/dashboard/Favorites";
import UrgentService from "./pages/UrgentService";
import MyWallet from "./pages/MyWallet";
import EPassPage from "./pages/EPassPage";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import GlobalBreadcrumbs from "@/components/GlobalBreadcrumbs";

// Admin Pages
import AdminOverview from "./pages/admin/AdminOverview";
import AdminWorkshop from "./pages/admin/AdminWorkshop";
import AdminManage from "./pages/admin/AdminManage";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminInventory from "./pages/admin/AdminInventory";
import AdminInventoryProducts from "./pages/admin/inventory/AdminInventoryProducts";
import AdminInventoryProductDetail from "./pages/admin/inventory/AdminInventoryProductDetail";
import AdminInventoryLocations from "./pages/admin/inventory/AdminInventoryLocations";
import AdminInventoryCategories from "./pages/admin/inventory/AdminInventoryCategories";
import AdminInventoryHistory from "./pages/admin/inventory/AdminInventoryHistory";
import AdminPlansManage from "./pages/admin/plans/AdminPlansManage";
import AdminPlanDetail from "./pages/admin/plans/AdminPlanDetail";
import AdminSubscriberDetail from "./pages/admin/plans/AdminSubscriberDetail";
import AdminCrm from "./pages/admin/AdminCrm";
import AdminCrmCustomerDetail from "./pages/admin/crm/AdminCrmCustomerDetail";
import AdminPickupPlaces from "./pages/admin/AdminPickupPlaces";

// Staff Pages
import StaffOverview from "./pages/staff/StaffOverview";
import StaffSchedule from "./pages/staff/StaffSchedule";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <CartProvider>
        <SystemStatusProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <GlobalBreadcrumbs />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/membership-plans" element={<MembershipPlans />} />
              <Route path="/accessories" element={<Accessories />} />
              <Route path="/accessories/:id" element={<AccessoryDetail />} />
              <Route path="/find-store" element={<FindStore />} />
              <Route path="/book-test-ride" element={<BookTestRide />} />
              <Route path="/our-story" element={<OurStory />} />
              <Route path="/career" element={<Career />} />
              <Route path="/help" element={<Help />} />
              <Route path="/delivery" element={<Delivery />} />
              <Route path="/returns" element={<Returns />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/chat" element={<Chat />} />
              
              {/* Member Dashboard Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/wallet" element={<MyWallet />} />
              <Route path="/dashboard/e-pass" element={<MyWallet />} />
              <Route path="/dashboard/v-id" element={<MyWallet />} />
              <Route path="/dashboard/service" element={<ServiceDashboard />} />
              <Route path="/dashboard/bike" element={<BikeCatalog />} />
              <Route path="/dashboard/membership" element={<Membership />} />
              <Route path="/dashboard/favorites" element={<Favorites />} />
              <Route path="/dashboard/vip" element={<Membership />} />
              <Route path="/dashboard/*" element={<Dashboard />} />
              
              {/* Admin Dashboard Routes */}
              <Route path="/dashboard/admin" element={<AdminOverview />} />
              <Route path="/dashboard/admin/workshop" element={<AdminWorkshop />} />
              <Route path="/dashboard/admin/manage" element={<AdminManage />} />
              <Route path="/dashboard/admin/plans" element={<AdminPlans />} />
              <Route path="/dashboard/admin/plans/manage" element={<AdminPlansManage />} />
              <Route path="/dashboard/admin/plans/subscriber/:subscriberId" element={<AdminSubscriberDetail />} />
              <Route path="/dashboard/admin/plans/:planId" element={<AdminPlanDetail />} />
              <Route path="/dashboard/admin/members" element={<AdminMembers />} />
              <Route path="/dashboard/admin/inventory" element={<AdminInventory />} />
              <Route path="/dashboard/admin/inventory/products" element={<AdminInventoryProducts />} />
              <Route path="/dashboard/admin/inventory/products/:id" element={<AdminInventoryProductDetail />} />
              <Route path="/dashboard/admin/inventory/locations" element={<AdminInventoryLocations />} />
              <Route path="/dashboard/admin/inventory/categories" element={<AdminInventoryCategories />} />
              <Route path="/dashboard/admin/inventory/history" element={<AdminInventoryHistory />} />
              <Route path="/dashboard/admin/crm" element={<AdminCrm />} />
              <Route path="/dashboard/admin/crm/:customerId" element={<AdminCrmCustomerDetail />} />
              <Route path="/dashboard/admin/pickup-places" element={<AdminPickupPlaces />} />
              
              {/* Staff Dashboard Routes */}
              <Route path="/dashboard/staff" element={<StaffOverview />} />
              <Route path="/dashboard/staff/schedule" element={<StaffSchedule />} />

              
              <Route path="/dashboard/urgent-service" element={<UrgentService />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </SystemStatusProvider>
      </CartProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
