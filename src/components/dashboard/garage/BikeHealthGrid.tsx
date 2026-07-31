import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssessmentHistoryDialog from "@/components/dashboard/garage/AssessmentHistoryDialog";
import type { HealthMetric } from "@/hooks/garage/useGarageBike";

/** Circular gauge in the system green. */
function Ring({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} className="stroke-muted-foreground/20" strokeWidth="6" fill="none" />
      <circle
        cx="24"
        cy="24"
        r={r}
        className="stroke-wj-green"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * value) / 100}
        transform="rotate(-90 24 24)"
      />
    </svg>
  );
}

function Bars({ value }: { value: number }) {
  const bars = 9;
  const filled = Math.round((value / 100) * bars);
  return (
    <div className="flex items-end gap-[3px] h-10 shrink-0">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          style={{ height: `${25 + ((i * 37) % 75)}%` }}
          className={`w-[4px] rounded-full ${i < filled ? "bg-wj-green" : "bg-muted-foreground/20"}`}
        />
      ))}
    </div>
  );
}

function Wave({ value }: { value: number }) {
  const pts = Array.from({ length: 20 }, (_, i) => {
    const y = 20 - Math.sin(i / 2.1) * (value / 12) - (value / 100) * 4;
    return `${i * 3},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width="60" height="40" viewBox="0 0 60 40" className="shrink-0">
      <polyline points={pts} fill="none" className="stroke-wj-green" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface BikeHealthGridProps {
  metrics: HealthMetric[];
  /** Opens the guided condition assessment (staff/admin only). */
  onAssess?: () => void;
  /** Latest registered assessment, shown as the source of truth per point. */
  assessment?: {
    scores: Record<string, number>;
    overall_score: number;
    condition_label: string;
    created_at: string;
  } | null;
  /** Bike used to load the review history shown to the customer. */
  bikeId?: string | null;
  bikeModel?: string | null;
}

/** Bike health board — one card per wear criterion, scored in percent. */
export default function BikeHealthGrid({
  metrics,
  onAssess,
  assessment,
  bikeId,
  bikeModel,
}: BikeHealthGridProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  // Metrics arrive already merged with the assessment (mergeAssessedHealth);
  // only override here when a raw telemetry list is passed in.
  const shown = metrics.map((m) =>
    assessment && assessment.scores?.[m.key] != null && !m.detail.startsWith("Assessed")
      ? { ...m, value: assessment.scores[m.key], detail: `Assessed · ${m.detail}` }
      : m,
  );
  return (
    <div className="space-y-3 lg:space-y-4">
      {(onAssess || bikeId) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md px-4 py-3">
          <div>
            <p className="text-xs text-foreground">Condition assessment</p>
            <p className="text-[10px] text-muted-foreground/80">
              {assessment
                ? `Last: ${assessment.overall_score}% · ${assessment.condition_label} · ${new Date(assessment.created_at).toLocaleDateString()}`
                : "No assessment registered for this bike yet."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {bikeId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHistoryOpen(true)}
                className="rounded-full"
              >
                <History className="h-4 w-4" /> Review history
              </Button>
            )}
            {onAssess && (
              <Button size="sm" onClick={onAssess} className="rounded-full">
                <ClipboardCheck className="h-4 w-4" /> Assess bike
              </Button>
            )}
          </div>
        </div>
      )}
      <AssessmentHistoryDialog
        bikeId={bikeId}
        bikeModel={bikeModel}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
      {shown.map((m, i) => (
        <motion.div
          key={m.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
          className="rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md p-4"
        >
          <p className="text-xs text-muted-foreground">{m.label}</p>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl font-light text-foreground tabular-nums leading-none">
                {m.value}
                <span className="text-sm text-muted-foreground">{m.unit}</span>
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">{m.detail}</p>
            </div>
            {m.chart === "ring" && <Ring value={m.value} />}
            {m.chart === "bars" && <Bars value={m.value} />}
            {m.chart === "wave" && <Wave value={m.value} />}
          </div>
        </motion.div>
      ))}
      </div>
    </div>
  );
}