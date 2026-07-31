import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffTodayQueue } from "@/hooks/staff/useStaffTodayQueue";
import { taskBucket, isTaskOverdue } from "@/lib/scheduling/taskPriority";

interface Props {
  userId: string | undefined;
}

const BUCKET_TONE: Record<string, string> = {
  ongoing: "bg-wj-green",
  overdue: "bg-orange-500",
  pending: "bg-amber-400",
  requested: "bg-sky-400",
};

/**
 * "Project"-style list from the reference layout: today's jobs ordered by the
 * global workshop priority rules so the mechanic always sees what is next.
 */
export default function TodayPriorityQueue({ userId }: Props) {
  const { rows, loading } = useStaffTodayQueue(userId, 6);
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="h-full rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md p-5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Priority queue</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Today
        </span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
          <ListChecks className="w-5 h-5 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">No jobs queued for today</p>
        </div>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {rows.map((a, i) => {
            const bucket = taskBucket(a as any);
            const late = isTaskOverdue(a as any);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() =>
                    (a as any).bike_id
                      ? navigate(`/dashboard/staff/garage/bike/${(a as any).bike_id}`)
                      : navigate("/dashboard/staff/workshop")
                  }
                  className="w-full text-left flex items-center gap-3 rounded-2xl border border-border/30 bg-muted/10 hover:bg-wj-green/10 transition-colors px-3 py-2.5"
                >
                  <span className="text-[10px] tabular-nums w-4 text-muted-foreground">
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      BUCKET_TONE[bucket] ?? "bg-muted-foreground",
                      bucket === "ongoing" && "animate-pulse",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-foreground truncate">
                      {a.service_name ?? "Service"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {a.customer_name ?? "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {late && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {a.scheduled_start_time.slice(0, 5)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
