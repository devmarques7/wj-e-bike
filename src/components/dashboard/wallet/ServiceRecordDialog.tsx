import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, ClipboardList, Image as ImageIcon, Wrench, FileText, Sparkles } from "lucide-react";
import { useActivityDetail, type ActivityRecord } from "@/hooks/wallet/useActivityYear";

interface Props {
  record: ActivityRecord | null;
  onOpenChange: (open: boolean) => void;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-wj-green" />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <div className="text-sm text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}

/**
 * Full record of one appointment: briefing, reported issue, resolution,
 * quality-control trail and the photos captured by the mechanic.
 */
export default function ServiceRecordDialog({ record, onOpenChange }: Props) {
  const { stages, photos, loading } = useActivityDetail(record?.id ?? null);

  const resolutionNotes = stages.filter((s) => s.notes);
  const qcDone = stages.reduce((s, x) => s + x.tasksDone, 0);
  const qcTotal = stages.reduce((s, x) => s + x.tasksTotal, 0);

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{record?.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {record &&
              new Date(record.date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            {" · "}
            <span className="capitalize">{record?.status.replace("_", " ")}</span>
          </p>
        </DialogHeader>

        {record && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-wj-green/10 text-wj-green text-xs font-medium px-3 py-1">
                +{record.points} points
              </span>
              {record.durationMinutes && (
                <span className="rounded-full bg-muted text-xs px-3 py-1 text-muted-foreground">
                  {record.durationMinutes} min
                </span>
              )}
              {record.extraCharge > 0 && (
                <span className="rounded-full bg-muted text-xs px-3 py-1 text-muted-foreground">
                  Extra €{record.extraCharge.toFixed(2)}
                </span>
              )}
            </div>

            <Section icon={FileText} title="Briefing">
              <p>{record.briefing || "No briefing was registered for this appointment."}</p>
            </Section>

            <Section icon={Wrench} title="Reported issue">
              <p>
                {record.briefing
                  ? record.briefing
                  : `${record.title} requested by the rider — no additional issue reported.`}
              </p>
            </Section>

            <Section icon={CheckCircle2} title="How it was solved">
              {loading ? (
                <p>Loading resolution…</p>
              ) : resolutionNotes.length > 0 ? (
                resolutionNotes.map((s) => (
                  <p key={s.id}>
                    <span className="text-foreground font-medium">{s.name}: </span>
                    {s.notes}
                  </p>
                ))
              ) : record.status === "completed" ? (
                <p>Service completed and validated by the workshop with no pending issues.</p>
              ) : (
                <p>Not resolved yet — this service is still {record.status.replace("_", " ")}.</p>
              )}
            </Section>

            <Section icon={ClipboardList} title="Quality control">
              {loading ? (
                <p>Loading checklist…</p>
              ) : stages.length === 0 ? (
                <p>No quality-control trail recorded for this service.</p>
              ) : (
                <>
                  <p className="text-xs">
                    <span className="text-foreground font-medium">{qcDone}</span> of {qcTotal} checks
                    completed across {stages.length} stages
                  </p>
                  <ul className="space-y-1.5 mt-2">
                    {stages.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-xs">
                        <span
                          className={
                            s.tasksTotal > 0 && s.tasksDone === s.tasksTotal
                              ? "h-2 w-2 rounded-full bg-wj-green"
                              : "h-2 w-2 rounded-full bg-muted-foreground/40"
                          }
                        />
                        <span className="text-foreground">{s.name}</span>
                        <span className="ml-auto">
                          {s.tasksDone}/{s.tasksTotal}
                          {s.durationSeconds ? ` · ${Math.round(s.durationSeconds / 60)} min` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            <Section icon={ImageIcon} title="Photos">
              {photos.length === 0 ? (
                <p>No photos were attached to this service.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((src) => (
                    <img
                      key={src}
                      src={src}
                      alt={`${record.title} quality control photo`}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl object-cover border border-border/50"
                    />
                  ))}
                </div>
              )}
            </Section>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-wj-green" />
              Record archived in your WJ wallet history.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}