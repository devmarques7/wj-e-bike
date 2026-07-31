import { motion } from "framer-motion";
import { Bike, Plus, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppointmentsEmptyStateProps {
  onCreate?: () => void;
  /** Hide the CTA (read-only views). */
  hideCta?: boolean;
  className?: string;
}

/**
 * Skeleton-backed empty state for the appointments table. Ghost rows keep the
 * table rhythm while a centered bike badge explains there is nothing booked.
 */
export default function AppointmentsEmptyState({
  onCreate,
  hideCta = false,
  className,
}: AppointmentsEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("relative flex-1 min-h-[280px] h-full w-full", className)}>
      {/* Ghost skeleton rows */}
      <div
        aria-hidden
        className="absolute inset-0 flex flex-col gap-px p-4 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-border/20">
            <div className="h-3 w-12 rounded-full bg-muted/50 animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
            <div className="h-3 flex-[2] rounded-full bg-muted/40 animate-pulse" style={{ animationDelay: `${i * 90 + 40}ms` }} />
            <div className="h-3 flex-1 rounded-full bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 90 + 80}ms` }} />
            <div className="h-3 w-16 rounded-full bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 90 + 120}ms` }} />
          </div>
        ))}
      </div>

      {/* Centered content */}
      <div className="relative h-full w-full flex flex-col items-center justify-center text-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-full bg-wj-green/10 blur-2xl" />
          <div className="relative h-20 w-20 rounded-full border border-border/40 bg-background/60 backdrop-blur-md flex items-center justify-center">
            <motion.div
              animate={{ x: [-2, 2, -2] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Bike className="h-9 w-9 text-wj-green" strokeWidth={1.25} />
            </motion.div>
            <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-background border border-border/40 flex items-center justify-center">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            </span>
          </div>
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 text-sm font-medium text-foreground"
        >
          {t("workshop.appts.empty_title")}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-1.5 text-xs text-muted-foreground max-w-[280px]"
        >
          {t("workshop.appts.empty_sub")}
        </motion.p>

        {!hideCta && onCreate && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <Button
              size="sm"
              onClick={onCreate}
              className="mt-5 h-9 rounded-full gap-1.5 text-xs bg-wj-green text-white hover:bg-wj-green/90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("workshop.appts.empty_cta")}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
