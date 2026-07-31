import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ClipboardCheck,
  Clock,
  Camera,
  Check,
  ListChecks,
  Loader2,
  User,
  Wrench,
  Calendar,
  CircleDollarSign,
  Mail,
  ShieldCheck,
  StickyNote,
  Repeat2,
  Hash,
  UserCog,
  Gauge,
  Receipt,
  CreditCard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { AppointmentRow, AppointmentRowFull } from "@/hooks/scheduling/useSchedulingData";

interface Props {
  appointment: AppointmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProgressRow = {
  id: string;
  stage_id: string;
  stage_name: string | null;
  stage_position: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  elapsed_from_start_seconds: number | null;
  task_results: Array<{ task_id: string; done: boolean }>;
  notes: string | null;
};

type AssessmentRow = {
  id: string;
  overall_score: number;
  condition_label: string;
  scores: Record<string, number> | null;
  answers: Record<string, unknown> | null;
  notes: string | null;
  is_second_hand: boolean | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  paid_at: string;
  notes: string | null;
  invoice_url: string | null;
};

const fmtDur = (s: number | null) => {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(x).padStart(2, "0")}s`;
};

const fmtAbs = (iso: string | null, locale = "pt") => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale === "pt" ? "pt-PT" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AppointmentReviewHistoryDialog({
  appointment,
  open,
  onOpenChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [details, setDetails] = useState<AppointmentRowFull | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const isCompleted = appointment?.status === "completed";

  useEffect(() => {
    if (!open || !appointment) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointment_qc_progress")
        .select(
          "id, stage_id, stage_name, stage_position, started_at, completed_at, duration_seconds, elapsed_from_start_seconds, task_results, notes",
        )
        .eq("appointment_id", appointment.id)
        .order("stage_position", { ascending: true });
      if (!cancelled) {
        if (!error) setRows((data as any) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, appointment]);

  /* Completed jobs → load the full aftercare history: the bike condition
     assessment recorded at handover and any payment charged around it. */
  useEffect(() => {
    if (!open || !appointment || appointment.status !== "completed") {
      setAssessment(null);
      setPayments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const bikeId = appointment.bike_id;
      const day = appointment.scheduled_date;
      const [assessRes, payRes] = await Promise.all([
        bikeId
          ? supabase
              .from("bike_assessments")
              .select("id, overall_score, condition_label, scores, answers, notes, is_second_hand, created_at")
              .eq("bike_id", bikeId)
              .order("created_at", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("payments")
          .select("id, amount, currency, status, method, paid_at, notes, invoice_url")
          .eq("user_id", appointment.user_id)
          .gte("paid_at", `${day}T00:00:00Z`)
          .lte("paid_at", `${day}T23:59:59Z`)
          .order("paid_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setAssessment(((assessRes as any).data?.[0] as AssessmentRow) ?? null);
      setPayments(((payRes as any).data as PaymentRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, appointment]);

  // Load the freshest full appointment row from the API on open so the
  // dialog always reflects server-side truth (notes, coverage, extra
  // charge, actual duration, booking channel, etc.).
  useEffect(() => {
    if (!open || !appointment) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailsLoading(true);
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointment.id)
        .maybeSingle();
      if (!cancelled) {
        setDetails(data ? ({ ...appointment, ...(data as any) } as AppointmentRowFull) : (appointment as AppointmentRowFull));
        setDetailsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, appointment]);

  const totalSeconds = (() => {
    if (!appointment?.work_started_at) return null;
    const end = appointment.work_ended_at
      ? new Date(appointment.work_ended_at).getTime()
      : null;
    if (!end) return null;
    return Math.max(
      0,
      Math.floor((end - new Date(appointment.work_started_at).getTime()) / 1000),
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background/95 backdrop-blur-xl border-border/40 max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogTitle className="text-base font-light flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-wj-green" />
            {t("workshop.review.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("workshop.review.desc")}
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <ScrollArea className="max-h-[75vh]">
            <div className="px-6 py-4 border-b border-border/30 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <DetailField icon={User} label={t("workshop.review.customer")}>
                <div className="font-medium truncate">{appointment.customer_name ?? "—"}</div>
                {appointment.customer_email && (
                  <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3" /> {appointment.customer_email}
                  </div>
                )}
              </DetailField>
              <DetailField icon={Wrench} label={t("workshop.review.service")}>
                <div className="flex items-center gap-1.5 font-medium truncate">
                  <span
                    className="inline-block w-1.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: appointment.service_color ?? "#9ca3af" }}
                  />
                  <span className="truncate">{appointment.service_name ?? "—"}</span>
                </div>
              </DetailField>
              <DetailField icon={Calendar} label={t("workshop.cols.time")}>
                <div className="font-medium tabular-nums">
                  {fmtAbs(`${appointment.scheduled_date}T${appointment.scheduled_start_time}`, i18n.language)}
                </div>
                {appointment.duration_minutes ? (
                  <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                    {appointment.duration_minutes} min
                  </div>
                ) : null}
              </DetailField>
              <DetailField icon={UserCog} label={t("workshop.cols.mechanic")}>
                <div className="font-medium truncate">
                  {appointment.mechanic_name ?? t("workshop.cols.unassigned")}
                </div>
              </DetailField>
              <DetailField icon={ShieldCheck} label={t("workshop.cols.plan")}>
                {appointment.plan_name ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                    style={{
                      color: appointment.plan_color ?? "#9ca3af",
                      borderColor: `${appointment.plan_color ?? "#9ca3af"}40`,
                      backgroundColor: `${appointment.plan_color ?? "#9ca3af"}15`,
                    }}
                  >
                    {appointment.plan_name}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">
                    {t("workshop.cols.no_plan")}
                  </span>
                )}
              </DetailField>
              <DetailField icon={Clock} label={t("workshop.review.total_duration")}>
                <div className="font-medium tabular-nums">
                  {totalSeconds != null
                    ? fmtDur(totalSeconds)
                    : details?.actual_duration_minutes
                    ? `${details.actual_duration_minutes}m`
                    : "—"}
                </div>
              </DetailField>
              <DetailField icon={CircleDollarSign} label={t("workshop.cols.plan")}>
                <div className="font-medium tabular-nums">
                  {details?.is_covered_by_plan
                    ? "✓"
                    : Number(details?.extra_charge_eur ?? 0) > 0
                    ? `€${Number(details?.extra_charge_eur).toFixed(2)}`
                    : "—"}
                </div>
              </DetailField>
              <DetailField icon={Repeat2} label="Reschedules">
                <div className="font-medium tabular-nums">
                  {details?.reschedule_count ?? 0}
                </div>
              </DetailField>
              <DetailField icon={Hash} label="ID">
                <div className="font-mono text-[10px] text-muted-foreground truncate">
                  {appointment.id.slice(0, 8)}
                </div>
              </DetailField>
            </div>

            {details?.notes && (
              <div className="px-6 py-3 border-b border-border/30">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <StickyNote className="h-3 w-3" /> Notes
                </div>
                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{details.notes}</p>
              </div>
            )}

            <div className="px-6 py-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                {t("workshop.review.title")}
              </div>
              {loading || detailsLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("workshop.review.loading")}
                </div>
              ) : rows.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {t("workshop.review.empty")}
                </div>
              ) : (
                <ol className="relative space-y-3">
                  {rows.map((r, i) => {
                    const completed = !!r.completed_at;
                    const taskCount = Array.isArray(r.task_results) ? r.task_results.length : 0;
                    const doneCount = Array.isArray(r.task_results)
                      ? r.task_results.filter((t) => t.done).length
                      : 0;
                    return (
                      <motion.li
                        key={r.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn("rounded-xl border border-border/30 bg-muted/20 p-4")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-medium border",
                                completed
                                  ? "bg-wj-green/10 text-wj-green border-wj-green/30"
                                  : "bg-muted/40 text-muted-foreground border-border/40",
                              )}
                            >
                              {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {r.stage_name ?? t("workshop.review.stage_fallback", { n: r.stage_position + 1 })}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {fmtAbs(r.completed_at, i18n.language)}
                                </span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <ListChecks className="h-3 w-3" />
                                  {t("workshop.review.tasks", { done: doneCount, total: taskCount })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {t("workshop.review.accumulated")}
                            </div>
                            <div className="text-sm font-light tabular-nums text-wj-green">
                              {fmtDur(r.elapsed_from_start_seconds ?? r.duration_seconds)}
                            </div>
                          </div>
                        </div>
                        {r.notes && (
                          <p className="mt-3 text-[11px] text-muted-foreground border-t border-border/20 pt-2">
                            {r.notes}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          <Badge className="text-[10px] gap-1 bg-muted/40 border-border/40 text-muted-foreground font-normal">
                            <Camera className="h-3 w-3" />
                            {t("workshop.review.photo_confirmed")}
                          </Badge>
                          {completed ? (
                            <Badge className="text-[10px] gap-1 bg-muted/30 text-foreground/80 border-border/40 font-normal">
                              <span className="w-1.5 h-1.5 rounded-full bg-wj-green inline-block" />
                              {t("workshop.review.status_done")}
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] gap-1 bg-muted/30 text-foreground/80 border-border/40 font-normal">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                              {t("workshop.review.status_running")}
                            </Badge>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      {children}
    </div>
  );
}