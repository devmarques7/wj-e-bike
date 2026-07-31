import { ReactNode, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import UnifiedDashboardHeader from "./UnifiedDashboardHeader";
import UnifiedFloatingNav from "./UnifiedFloatingNav";
import AutoBreadcrumbs from "@/components/AutoBreadcrumbs";
import { useDashboardNav } from "@/hooks/useDashboardNav";

interface UnifiedDashboardLayoutProps {
  children: ReactNode;
}

/**
 * Single dashboard shell used by every role (admin, staff, customer).
 * Header + mobile nav switch content via useDashboardNav(), but the layout
 * itself — video background, glass tumbler, breadcrumbs — stays constant.
 */
export default function UnifiedDashboardLayout({ children }: UnifiedDashboardLayoutProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nav = useDashboardNav();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration - video.currentTime < 0.5) {
        video.style.opacity = "0";
        setTimeout(() => {
          video.currentTime = 0;
          video.play();
          video.style.opacity = "1";
        }, 300);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Video background */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 w-full h-full object-cover transition-opacity duration-300 z-0"
      >
        <source src="/videos/dashboard-background.mp4" type="video/mp4" />
      </video>

      <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[1]" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Desktop header */}
        <div className="hidden lg:block">
          <UnifiedDashboardHeader />
        </div>

        {/* Mobile header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-lg font-bold tracking-wider">
              <span className="text-foreground">{nav.brand.prefix}</span>
              <span className="text-wj-green">{nav.brand.suffix}</span>
            </span>
          </div>
        </div>

        <main className="flex-1 flex flex-col pt-16 lg:pt-0 pb-24 lg:pb-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col h-fit w-full lg:my-4 lg:rounded-3xl lg:bg-background/40 lg:backdrop-blur-md lg:border lg:border-border/30 lg:overflow-hidden lg:min-h-[calc(100vh-5rem)] pb-4 lg:pb-6"
          >
            <div className="px-4 lg:px-6 pt-4">
              <AutoBreadcrumbs />
            </div>
            <div className="flex-1 flex flex-col min-w-0">{children}</div>
          </motion.div>
        </main>

        <div className="lg:hidden">
          <UnifiedFloatingNav />
        </div>
      </div>
    </div>
  );
}