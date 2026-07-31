import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bike as BikeIcon,
  CalendarClock,
  ClipboardList,
  Euro,
  Gauge,
  History,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BikeBriefing } from "@/hooks/workshop/useBikeBriefing";

interface Props {
  briefing: BikeBriefing | null;
  loading: boolean;
  customerName?: string | null;
  acknowledged: boolean;
  onAcknowledge: () => void;
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-xs text-foreground">{value}</p>
    </div>
  );
}

export default function BikeBriefingPanel({
  briefing,
  loading,
  customerName,
  acknowledged,
  onAcknowledge,
}: Props) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading bike briefing…
      </div>
    );
  }

  const points = briefing?.reportedPoints ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col rounded-2xl border border-border/30 bg-background/60 overflow-hidden"
    >
      <div className="p-4 border-b border-border/30 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stage 0</p>
          <h3 className="text-sm font-medium text-foreground">Bike briefing</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Everything reported for {customerName ?? "this customer"} before Quality Control starts.
          </p>
        </div>
        <Badge
          className={cn(
            "text-[9px] h-5 px-2 shrink-0",
            acknowledged
              ? "bg-wj-green/15 text-wj-green border-wj-green/30"
              : "bg-amber-500/15 text-amber-400 border-amber-500/30",
          )}
        >
          {acknowledged ? "Reviewed" : "Pending review"}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Reported problem */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-400">
              <ClipboardList className="h-3 w-3" /> Reported problem
            </div>
            {points.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground italic">
                No problem description was submitted with this booking.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs text-foreground">
                    <span className="text-amber-400">{i + 1}.</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Appointment facts */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Field icon={ShieldCheck} label="Service" value={briefing?.serviceName ?? "—"} />
            <Field
              icon={CalendarClock}
              label="Planned time"
              value={briefing?.durationMinutes ? `${briefing.durationMinutes} min` : "—"}
            />
            <Field
              icon={Euro}
              label="Coverage"
              value={
                briefing?.isCoveredByPlan
                  ? "Covered by plan"
                  : briefing?.extraChargeEur
                    ? `Extra €${Number(briefing.extraChargeEur).toFixed(2)}`
                    : "Not covered"
              }
            />
            <Field
              icon={AlertTriangle}
              label="Priority"
              value={briefing?.priority ? briefing.priority.toUpperCase() : "NORMAL"}
            />
          </div>

          {/* Bike */}
          {briefing?.bike && (
            <div className="rounded-xl border border-border/30 bg-background/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <BikeIcon className="h-3 w-3" /> Bike
              </div>
              <p className="mt-1 text-sm text-foreground">{briefing.bike.model}</p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                <span>Serial: {briefing.bike.serial ?? "—"}</span>
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" /> {briefing.bike.km} km
                </span>
                <span>Last service: {briefing.bike.last_service_at ?? "—"}</span>
                <span>Services done: {briefing.bike.services_completed}</span>
              </div>
            </div>
          )}

          {/* History */}
          <div className="rounded-xl border border-border/30 bg-background/60 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <History className="h-3 w-3" /> Previous appointments
            </div>
            {(briefing?.history ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground italic">No previous records.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {briefing!.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-foreground truncate">
                      {h.scheduled_date} · {h.service_name ?? "Service"}
                    </span>
                    <Badge className="text-[9px] h-4 px-1.5 bg-muted/50 text-muted-foreground border-border/40">
                      {h.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {briefing?.notes && (
            <div className="rounded-xl border border-border/30 bg-background/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Raw notes</p>
              <p className="mt-1 text-[11px] text-muted-foreground whitespace-pre-line">
                {briefing.notes}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border/30 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          Confirm you read the briefing to unlock the QC stages.
        </span>
        <Button
          size="sm"
          disabled={acknowledged}
          onClick={onAcknowledge}
          className="bg-wj-green hover:bg-wj-green/90 text-black h-8 text-xs"
        >
          {acknowledged ? "Briefing reviewed" : "Start Quality Control"}
        </Button>
      </div>
    </motion.div>
  );
}
