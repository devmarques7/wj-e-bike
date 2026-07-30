import { Bike as BikeIcon } from "lucide-react";
import { motion } from "framer-motion";

export interface BikeTabItem {
  id: string;
  model: string;
  serial?: string | null;
}

interface Props {
  bikes: BikeTabItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Shared bike selector used on the Dashboard and Garage pages.
 * Everything on the page (urgent service, plan card, next revision, bookings)
 * is scoped to the bike selected here.
 */
export default function BikeTabs({ bikes, activeId, onSelect, className = "" }: Props) {
  if (!bikes.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {bikes.map((b) => {
        const active = b.id === activeId;
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              active
                ? "border-wj-green/50 bg-wj-green/10 text-foreground"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <BikeIcon className={`h-3.5 w-3.5 ${active ? "text-wj-green" : "text-muted-foreground"}`} />
            <span className="truncate max-w-[160px]">{b.model}</span>
            {b.serial && (
              <span className="hidden sm:inline text-[10px] text-muted-foreground/70 tabular-nums">
                {b.serial}
              </span>
            )}
          </button>
        );
      })}
    </motion.div>
  );
}
