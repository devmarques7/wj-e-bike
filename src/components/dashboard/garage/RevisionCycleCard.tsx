import { motion } from "framer-motion";
import { CalendarClock, Crown, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { REVISION_CYCLE_MONTHS } from "@/hooks/garage/useGarageBike";

interface Props {
  nextRevision: Date | null;
  daysToRevision: number | null;
  lastServiceAt: string | null;
  planName: string | null;
  revisionsIncluded: number;
  revisionsUsed: number;
}

/**
 * Next revision countdown (standard 3-month cycle) + plan coverage.
 * When the plan quota is exhausted, the upgrade path is highlighted.
 */
export default function RevisionCycleCard({
  nextRevision,
  daysToRevision,
  lastServiceAt,
  planName,
  revisionsIncluded,
  revisionsUsed,
}: Props) {
  const remaining = Math.max(0, revisionsIncluded - revisionsUsed);
  const exhausted = remaining === 0;
  const overdue = daysToRevision !== null && daysToRevision < 0;
  const progress =
    daysToRevision === null
      ? 0
      : Math.max(0, Math.min(100, 100 - (daysToRevision / (REVISION_CYCLE_MONTHS * 30)) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
      className="rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md p-5 h-full flex flex-col gap-4"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="h-4 w-4 text-wj-green" />
        Next revision · {REVISION_CYCLE_MONTHS}-month cycle
      </div>

      <div>
        <p
          className={`text-3xl font-light tabular-nums ${
            overdue ? "text-orange-500" : "text-foreground"
          }`}
        >
          {daysToRevision === null
            ? "—"
            : overdue
              ? `${Math.abs(daysToRevision)}d overdue`
              : `${daysToRevision} days`}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {nextRevision
            ? `Scheduled window: ${nextRevision.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}`
            : "Register your first service to start the cycle"}
        </p>
        <p className="text-[11px] text-muted-foreground/70">
          Last service:{" "}
          {lastServiceAt
            ? new Date(lastServiceAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "no record"}
        </p>
      </div>

      <div className="h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
        <div
          className={`h-full rounded-full ${overdue ? "bg-orange-500" : "bg-wj-green"}`}
          style={{ width: `${overdue ? 100 : progress}%` }}
        />
      </div>

      <div className="rounded-2xl border border-border/20 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-wj-green" />
            {planName ?? "No active plan"}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {revisionsUsed}/{revisionsIncluded} used
          </span>
        </div>
        <p
          className={`mt-2 text-xs ${exhausted ? "text-orange-500" : "text-muted-foreground/80"}`}
        >
          {exhausted ? (
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert className="h-3.5 w-3.5" />
              Revision quota reached for this period
            </span>
          ) : (
            `${remaining} covered revision${remaining === 1 ? "" : "s"} left in this period`
          )}
        </p>
      </div>

      <Button
        asChild
        className={`mt-auto rounded-full gap-2 ${
          exhausted ? "bg-wj-green hover:bg-wj-green/90" : "bg-muted/40 hover:bg-muted/60 text-foreground"
        }`}
      >
        <Link to="/dashboard/membership">
          <Crown className="h-4 w-4" />
          {exhausted ? "Upgrade plan for more revisions" : "Compare membership plans"}
        </Link>
      </Button>
    </motion.div>
  );
}