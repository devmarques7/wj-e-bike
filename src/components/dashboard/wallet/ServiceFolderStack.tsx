import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Folder, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/dashboard/EmptyState";
import type { ActivityRecord } from "@/hooks/wallet/useActivityYear";

interface Props {
  records: ActivityRecord[];
  onOpen: (record: ActivityRecord) => void;
  loading?: boolean;
}

/** Rotating tint palette for the stacked folders (Apple "Recents files" style). */
const TINTS = [
  "bg-[hsl(var(--muted))]",
  "bg-wj-green/20",
  "bg-amber-500/15",
  "bg-sky-500/15",
  "bg-rose-500/15",
];

/**
 * Service history rendered as overlapping folders — one per appointment/revision.
 * Hovering lifts the folder, clicking opens its full record.
 */
export default function ServiceFolderStack({ records, onOpen, loading }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const folders = useMemo(() => records.slice(0, 12), [records]);

  if (!loading && folders.length === 0) {
    return (
      <EmptyState
        icon={Folder}
        title="No service folders yet"
        description="Each revision or repair you book becomes a folder with its full record."
      />
    );
  }

  return (
    <div className="relative pb-4">
      {folders.map((r, i) => {
        const isHovered = hovered === r.id;
        return (
          <motion.button
            key={r.id}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onOpen(r)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: isHovered ? -8 : 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28, delay: Math.min(i * 0.03, 0.3) }}
            style={{ marginTop: i === 0 ? 0 : -26, zIndex: i + 1 }}
            className={cn(
              "relative block w-full text-left rounded-2xl border border-border/50 px-5 pt-4 pb-8 shadow-sm hover:shadow-lg transition-shadow",
              TINTS[i % TINTS.length],
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground leading-tight truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(r.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {r.durationMinutes ? ` · ${r.durationMinutes} min` : ""}
                  {" · "}
                  <span className="capitalize">{r.status.replace("_", " ")}</span>
                </p>
              </div>
              <span className="shrink-0 flex items-center gap-2">
                {r.points > 0 && (
                  <span className="text-xs font-semibold text-wj-green">+{r.points}</span>
                )}
                <span
                  className={cn(
                    "h-7 w-7 rounded-full bg-background/70 flex items-center justify-center transition-opacity",
                    isHovered ? "opacity-100" : "opacity-0",
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5 text-foreground" />
                </span>
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}