import { History, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssessmentHistory } from "@/hooks/garage/useAssessmentHistory";
import { ASSESSMENT_QUESTIONS } from "@/lib/garage/assessment";

interface Props {
  bikeId?: string | null;
  bikeModel?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Read-only review history: every answer given by the staff per assessment. */
export default function AssessmentHistoryDialog({ bikeId, bikeModel, open, onOpenChange }: Props) {
  const { records, loading } = useAssessmentHistory(open ? bikeId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-light flex items-center gap-2">
            <History className="h-4 w-4 text-wj-green" /> Assessment history
          </DialogTitle>
          <DialogDescription>
            {bikeModel ? `Reviews registered for ${bikeModel}.` : "Reviews registered for this bike."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No assessment has been registered by the workshop yet.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4">
              {records.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border/40 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-foreground">
                        {r.overall_score}% · {r.condition_label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()} ·{" "}
                        {r.is_second_hand ? "Second-hand" : "New bike"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {ASSESSMENT_QUESTIONS.map((q) => {
                      const answerId = (r.answers ?? {})[q.key];
                      if (!answerId) return null;
                      const opt = q.options.find((o) => o.id === answerId);
                      const score = r.scores?.[q.key];
                      return (
                        <div
                          key={q.key}
                          className="flex items-start justify-between gap-3 border-t border-border/30 pt-2"
                        >
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                              {q.label}
                            </p>
                            <p className="text-sm text-foreground">{opt?.label ?? answerId}</p>
                            {opt?.hint && (
                              <p className="text-[11px] text-muted-foreground/70">{opt.hint}</p>
                            )}
                          </div>
                          {score != null && (
                            <span className="text-sm tabular-nums text-wj-green">{score}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {r.notes && (
                    <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                      {r.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
