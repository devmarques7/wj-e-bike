import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, History, ScanLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecentEPass } from "@/hooks/garage/useRecentEPass";
import { clearRecentEPassVisits } from "@/lib/garage/recentEpass";

/**
 * "Resume review" card — brings staff back to the last E-Pass bike they were
 * reviewing in this session. Updates automatically on every new scan.
 */
export default function RecentEPassCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { visits, last } = useRecentEPass();

  if (!last) return null;

  const others = visits.slice(1);
  const ago = (at: number) => {
    const m = Math.max(0, Math.round((Date.now() - at) / 60000));
    return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "rounded-3xl border border-border/30 bg-card/40 backdrop-blur-xl p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <History className="h-3 w-3 text-wj-green" /> Resume E-Pass review
        </span>
        <button
          type="button"
          onClick={clearRecentEPassVisits}
          className="text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Clear recent E-Pass visits"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/dashboard/staff/bike/${last.bikeId}`)}
        className="group w-full flex items-center gap-3 rounded-2xl border border-border/30 bg-background/40 p-3 text-left transition-colors hover:border-wj-green/50 hover:bg-wj-green/5"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border/30 bg-muted/30 flex items-center justify-center">
          {last.imageUrl ? (
            <img
              src={last.imageUrl}
              alt={last.model ?? "Bike"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ScanLine className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{last.model ?? "Scanned bike"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {last.serial ? `${last.serial} · ` : ""}
            {last.ownerName ?? "Unknown owner"} · {ago(last.at)}
          </p>
        </div>
        {typeof last.overall === "number" && (
          <span className="shrink-0 rounded-full border border-wj-green/40 bg-wj-green/10 px-2 py-0.5 text-[10px] text-wj-green">
            {last.overall}%
          </span>
        )}
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-wj-green" />
      </button>

      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {others.map((v) => (
            <button
              key={v.bikeId}
              type="button"
              onClick={() => navigate(`/dashboard/staff/bike/${v.bikeId}`)}
              className="rounded-lg border border-border/30 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-wj-green/50 hover:text-foreground"
            >
              {v.model ?? v.serial ?? "Bike"}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
