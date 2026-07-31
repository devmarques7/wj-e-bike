import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BikeAssessmentDialog from "@/components/dashboard/garage/BikeAssessmentDialog";
import { useTranslation } from "react-i18next";
import {
  Clock,
  CheckCircle2,
  Check,
  Loader2,
  ShieldCheck,
  ListChecks,
  ChevronRight,
  Camera,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppointmentRow } from "@/hooks/scheduling/useSchedulingData";
import { useBikeBriefing } from "@/hooks/workshop/useBikeBriefing";
import BikeBriefingPanel from "./BikeBriefingPanel";
import DeliveryChecklistPanel, { type DeliveryItem } from "./DeliveryChecklistPanel";
import { useWorkPause } from "@/lib/workshop/workPause";
import { ensureShiftActive } from "@/hooks/useShift";
import { awardAppointmentPoints } from "@/lib/rewards/rewards";

const BRIEFING_ID = "__briefing__";
const DELIVERY_ID = "__delivery__";

/* Session persistence: once a mechanic starts the control or checks delivery
   items, that state survives closing/re-opening the drawer in the same tab. */
const sessionKey = (id: string) => `wj_qc_session_${id}`;
type QcSession = {
  ack?: boolean;
  delivery?: Record<string, boolean>;
  assessDone?: boolean;
};
function readQcSession(id?: string | null): QcSession {
  if (!id) return {};
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey(id)) ?? "{}") as QcSession;
  } catch {
    return {};
  }
}
function writeQcSession(id: string | null | undefined, patch: QcSession) {
  if (!id) return;
  try {
    const next = { ...readQcSession(id), ...patch };
    sessionStorage.setItem(sessionKey(id), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const DEFAULT_DELIVERY_ITEMS: DeliveryItem[] = [
  { id: "d_reported", label: "All reported points were reviewed with the customer", source: "default" },
  { id: "d_brakes", label: "Brakes and safety check after the intervention", source: "default" },
  { id: "d_battery", label: "Battery charged and drive unit tested", source: "default" },
  { id: "d_torque", label: "Bolts torqued and test ride performed", source: "default" },
  { id: "d_clean", label: "Bike cleaned and ready for handover", source: "default" },
];

interface Props {
  appointment: AppointmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}


type Stage = {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  position: number;
  requires_photo: boolean;
  photo_min_count: number;
};

type Task = {
  id: string;
  stage_id: string;
  label: string;
  description: string | null;
  position: number;
  is_required: boolean;
};

type StageProgress = {
  started_at: number | null;
  completed_at: number | null;
  duration_seconds: number | null;
  elapsed_from_start_seconds: number | null;
  task_done: Record<string, boolean>;
  has_photo: boolean;
};

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};

export default function AppointmentCompletionDrawer({
  appointment,
  open,
  onOpenChange,
  onCompleted,
}: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Record<string, StageProgress>>({});
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [briefingAck, setBriefingAck] = useState(false);
  /* Local mirror of work_started_at: the timer only starts when the mechanic
     presses "Start Control" on the briefing stage. */
  const [startedAtLocal, setStartedAtLocal] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [deliveryChecked, setDeliveryChecked] = useState<Record<string, boolean>>({});
  /* Final condition validation (same SSBike flow used on the E-Pass page). */
  const [assessOpen, setAssessOpen] = useState(false);
  const [assessDone, setAssessDone] = useState(false);
  /* True when the assessment was opened as the final step of completing. */
  const completeAfterAssessRef = useRef(false);

  const { briefing, loading: briefingLoading } = useBikeBriefing(appointment?.id, open);
  const { workNow } = useWorkPause();

  const deliveryItems = useMemo<DeliveryItem[]>(() => {
    const reported = (briefing?.reportedPoints ?? []).map((p, i) => ({
      id: `r_${i}`,
      label: `Reviewed: ${p}`,
      source: "reported" as const,
    }));
    return [...reported, ...DEFAULT_DELIVERY_ITEMS];
  }, [briefing]);

  const allDeliveryChecked = deliveryItems.every((i) => deliveryChecked[i.id]);
  const assessBikeId = briefing?.bike?.id ?? ((appointment as any)?.bike_id as string | undefined) ?? null;

  // ticker for live timer
  useEffect(() => {
    if (!open) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [open]);

  // Restore the per-appointment session state whenever a job is opened.
  useEffect(() => {
    if (!open || !appointment?.id) return;
    const s = readQcSession(appointment.id);
    setAssessDone(!!s.assessDone);
    setAssessOpen(false);
    setBriefingAck(!!s.ack || !!(appointment as any)?.work_started_at);
    setDeliveryChecked(s.delivery ?? {});
  }, [appointment?.id, open]);

  // Persist checklist + gates in session storage.
  useEffect(() => {
    if (!open || !appointment?.id) return;
    writeQcSession(appointment.id, {
      ack: briefingAck,
      delivery: deliveryChecked,
      assessDone,
    });
  }, [open, appointment?.id, briefingAck, deliveryChecked, assessDone]);

  // Global appointment start (drives the live cumulative timer)
  const workStartedAtMs = useMemo(() => {
    const v = (appointment as any)?.work_started_at;
    return v ? new Date(v).getTime() : startedAtLocal;
  }, [appointment, startedAtLocal]);

  /** Start Control: clock in, flip the job to in_progress and start the timer. */
  const startControl = useCallback(async () => {
    if (!appointment || starting) return;
    setStarting(true);
    try {
      if (!workStartedAtMs) {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        await ensureShiftActive(uid);
        const startedAt = new Date();
        const { error } = await supabase
          .from("appointments")
          .update({
            status: "in_progress",
            work_started_at: startedAt.toISOString(),
            assigned_mechanic_id: appointment.assigned_mechanic_id ?? uid,
          })
          .eq("id", appointment.id);
        if (error) throw error;
        setStartedAtLocal(startedAt.getTime());
      }
      setBriefingAck(true);
      const first = stages.find((s) => !progress[s.id]?.completed_at) ?? stages[0];
      setActiveStageId(first?.id ?? DELIVERY_ID);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start this job");
    } finally {
      setStarting(false);
    }
  }, [appointment, starting, workStartedAtMs, stages, progress]);

  const elapsedFromStartSeconds = useMemo(() => {
    if (!workStartedAtMs) return 0;
    return Math.max(0, Math.floor((workNow() - workStartedAtMs) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workStartedAtMs, tick]);

  const loadTemplate = useCallback(async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const { data: tpl, error: tplErr } = await supabase
        .from("qc_templates")
        .select("id")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (tplErr) throw tplErr;
      if (!tpl) {
        setStages([]);
        setTasks([]);
        return;
      }
      const [sRes, kRes, prRes] = await Promise.all([
        supabase
          .from("qc_stages")
          .select("*")
          .eq("template_id", tpl.id)
          .order("position", { ascending: true }),
        supabase
          .from("qc_tasks")
          .select("*")
          .order("position", { ascending: true }),
        supabase
          .from("appointment_qc_progress")
          .select("*")
          .eq("appointment_id", appointment.id),
      ]);
      if (sRes.error) throw sRes.error;
      if (kRes.error) throw kRes.error;
      const st = (sRes.data ?? []) as Stage[];
      const tk = ((kRes.data ?? []) as Task[]).filter((t) =>
        st.some((s) => s.id === t.stage_id),
      );
      setStages(st);
      setTasks(tk);

      // hydrate progress
      const map: Record<string, StageProgress> = {};
      st.forEach((s) => {
        const row = (prRes.data ?? []).find((p: any) => p.stage_id === s.id);
        const tr = (row?.task_results ?? []) as Array<{ task_id: string; done: boolean }>;
        map[s.id] = {
          started_at: row?.started_at ? new Date(row.started_at).getTime() : null,
          completed_at: row?.completed_at ? new Date(row.completed_at).getTime() : null,
          duration_seconds: row?.duration_seconds ?? null,
          elapsed_from_start_seconds: (row as any)?.elapsed_from_start_seconds ?? null,
          task_done: Object.fromEntries(tr.map((t) => [t.task_id, !!t.done])),
          has_photo: !s.requires_photo
            ? true
            : Array.isArray(row?.task_results)
              ? !!(row as any)?.notes || tr.length > 0 // heuristic — UI marks via toggle below
              : false,
        };
      });
      setProgress(map);

      // stage 0 is the briefing — skip it when it was already acknowledged
      const acked =
        !!readQcSession(appointment.id).ack || !!(appointment as any)?.work_started_at;
      if (acked) {
        const first = st.find((s) => !map[s.id]?.completed_at) ?? st[0];
        setActiveStageId(first?.id ?? DELIVERY_ID);
      } else {
        setActiveStageId(BRIEFING_ID);
      }
    } catch (e: any) {
      toast.error(e.message ?? t("workshop.drawer.load_error"));
    } finally {
      setLoading(false);
    }
  }, [appointment, t]);

  useEffect(() => {
    if (open && appointment) loadTemplate();
    if (!open) {
      setStages([]);
      setTasks([]);
      setProgress({});
      setActiveStageId(null);
      setBriefingAck(false);
      setDeliveryChecked({});
      setStartedAtLocal(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  // Stage "started_at" is anchored to the appointment work_started_at — the
  // QC timer is a single cumulative counter for the whole appointment.
  useEffect(() => {
    if (!activeStageId || !workStartedAtMs) return;
    setProgress((prev) => {
      const cur = prev[activeStageId];
      if (!cur) return prev;
      if (cur.started_at || cur.completed_at) return prev;
      return { ...prev, [activeStageId]: { ...cur, started_at: workStartedAtMs } };
    });
  }, [activeStageId, workStartedAtMs]);

  const tasksByStage = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const arr = m.get(t.stage_id) ?? [];
      arr.push(t);
      m.set(t.stage_id, arr);
    });
    return m;
  }, [tasks]);

  const activeStage = stages.find((s) => s.id === activeStageId) ?? null;
  const activeTasks = activeStage ? tasksByStage.get(activeStage.id) ?? [] : [];
  const activeProgress = activeStageId ? progress[activeStageId] : null;

  const allStagesCompleted =
    stages.length === 0 || stages.every((s) => !!progress[s.id]?.completed_at);

  // For the active stage we show the live cumulative timer from work_started_at,
  // or the frozen cumulative value at the moment the stage was completed.
  const displayStageSeconds = useMemo(() => {
    if (!activeProgress) return elapsedFromStartSeconds;
    if (activeProgress.completed_at)
      return (
        activeProgress.elapsed_from_start_seconds ??
        activeProgress.duration_seconds ??
        0
      );
    return elapsedFromStartSeconds;
  }, [activeProgress, elapsedFromStartSeconds]);

  const toggleTask = (taskId: string) => {
    if (!activeStageId) return;
    setProgress((prev) => {
      const cur = prev[activeStageId];
      if (!cur || cur.completed_at) return prev;
      return {
        ...prev,
        [activeStageId]: {
          ...cur,
          task_done: { ...cur.task_done, [taskId]: !cur.task_done[taskId] },
        },
      };
    });
  };

  const togglePhoto = () => {
    if (!activeStageId) return;
    setProgress((prev) => {
      const cur = prev[activeStageId];
      if (!cur || cur.completed_at) return prev;
      return { ...prev, [activeStageId]: { ...cur, has_photo: !cur.has_photo } };
    });
  };

  const canCompleteActive = useMemo(() => {
    if (!activeStage || !activeProgress) return false;
    const requiredTasksDone = activeTasks
      .filter((t) => t.is_required)
      .every((t) => activeProgress.task_done[t.id]);
    const photoOk = activeStage.requires_photo ? activeProgress.has_photo : true;
    return requiredTasksDone && photoOk;
  }, [activeStage, activeProgress, activeTasks]);

  const persistStage = async (stage: Stage, prog: StageProgress) => {
    if (!appointment) return false;
    const tr = Object.entries(prog.task_done).map(([task_id, done]) => ({ task_id, done }));
    const payload = {
      appointment_id: appointment.id,
      stage_id: stage.id,
      template_id: stage.template_id,
      stage_name: stage.name,
      stage_position: stage.position,
      started_at: prog.started_at ? new Date(prog.started_at).toISOString() : null,
      completed_at: prog.completed_at ? new Date(prog.completed_at).toISOString() : null,
      duration_seconds: prog.duration_seconds,
      elapsed_from_start_seconds: prog.elapsed_from_start_seconds,
      task_results: tr,
    } as any;
    const { error } = await supabase
      .from("appointment_qc_progress")
      .upsert(payload, { onConflict: "appointment_id,stage_id" });
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const completeActiveStage = async () => {
    if (!activeStage || !activeProgress || !canCompleteActive) return;
    const now = Date.now();
    // duration_seconds = cumulative seconds from appointment start to now
    const cumulative = workStartedAtMs
      ? Math.max(0, Math.floor((now - workStartedAtMs) / 1000))
      : activeProgress.started_at
        ? Math.floor((now - activeProgress.started_at) / 1000)
        : 0;
    const updated: StageProgress = {
      ...activeProgress,
      completed_at: now,
      duration_seconds: cumulative,
      elapsed_from_start_seconds: cumulative,
    };
    setSaving(true);
    const ok = await persistStage(activeStage, updated);
    setSaving(false);
    if (!ok) return;
    setProgress((prev) => ({ ...prev, [activeStage.id]: updated }));
    // jump to next incomplete
    const idx = stages.findIndex((s) => s.id === activeStage.id);
    const next = stages.slice(idx + 1).find((s) => !progress[s.id]?.completed_at);
    setActiveStageId(next ? next.id : DELIVERY_ID);
  };

  const completeAppointment = async (conditionScore?: number | null) => {
    if (!appointment) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const meId = auth?.user?.id ?? null;
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "completed",
        work_ended_at: new Date().toISOString(),
        // Register who actually finished the job, and claim the appointment
        // when it was never assigned to a mechanic.
        completed_by: meId,
        ...(appointment.assigned_mechanic_id || !meId
          ? {}
          : { assigned_mechanic_id: meId }),
      })
      .eq("id", appointment.id);
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    /* Award the E-Pass points for this revision: service points + condition
       bonus + extra items purchased, using the database reward rules. */
    const { points } = await awardAppointmentPoints(appointment.id, conditionScore ?? null);
    setSaving(false);
    if (points > 0) toast.success(`+${points} E-Pass points awarded`);
    toast.success(t("workshop.drawer.done_toast"));
    onCompleted();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] sm:h-[88vh] p-0 bg-background/95 backdrop-blur-xl border-t border-border/40 rounded-t-3xl flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-light">
            <ShieldCheck className="h-4 w-4 text-wj-green" />
            {t("workshop.drawer.title")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t("workshop.drawer.desc", { name: appointment?.customer_name ?? t("workshop.drawer.desc_fallback") })}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("workshop.drawer.loading")}
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-12 gap-4 px-4 sm:px-6 pb-6 overflow-hidden">
            {/* Stages sidebar */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 overflow-hidden">
              <ScrollArea className="h-full pr-2">
                <div className="space-y-1.5">
                  {/* Stage 0 — briefing */}
                  <button
                    onClick={() => setActiveStageId(BRIEFING_ID)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 transition-all flex items-center gap-3",
                      activeStageId === BRIEFING_ID
                        ? "bg-wj-green/10 border-wj-green/40"
                        : briefingAck
                          ? "bg-muted/30 border-border/30"
                          : "bg-transparent border-primary/60 ring-1 ring-primary/30",
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0",
                        briefingAck
                          ? "bg-wj-green text-black"
                          : "bg-transparent text-primary border border-primary/60",
                      )}
                    >
                      {briefingAck ? <Check className="h-3.5 w-3.5" /> : 0}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">Bike briefing</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(briefing?.reportedPoints?.length ?? 0)} reported point(s)
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </button>

                  {stages.map((s, i) => {
                    const p = progress[s.id];
                    const done = !!p?.completed_at;
                    const active = s.id === activeStageId;
                    return (
                      <button
                        key={s.id}
                        disabled={!briefingAck}
                        onClick={() => setActiveStageId(s.id)}
                        className={cn(
                          "w-full text-left rounded-xl border p-3 transition-all flex items-center gap-3",
                          !briefingAck && "opacity-40 cursor-not-allowed",
                          active
                            ? "bg-wj-green/10 border-wj-green/40"
                            : done
                              ? "bg-muted/30 border-border/30"
                              : "bg-background/60 border-border/30 hover:bg-muted/30",
                        )}
                      >
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0",
                            done
                              ? "bg-wj-green text-black"
                              : active
                                ? "bg-wj-green/20 text-wj-green border border-wj-green/40"
                                : "bg-muted/50 text-muted-foreground",
                          )}
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{s.name}</p>
                          {p?.duration_seconds != null && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {fmt(p.duration_seconds)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </button>
                    );
                  })}

                  {/* Final — delivery checklist */}
                  <button
                    disabled={!briefingAck}
                    onClick={() => setActiveStageId(DELIVERY_ID)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 transition-all flex items-center gap-3",
                      !briefingAck && "opacity-40 cursor-not-allowed",
                      activeStageId === DELIVERY_ID
                        ? "bg-wj-green/10 border-wj-green/40"
                        : "bg-background/60 border-border/30 hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0",
                        allDeliveryChecked
                          ? "bg-wj-green text-black"
                          : "bg-muted/50 text-muted-foreground",
                      )}
                    >
                      {allDeliveryChecked ? <Check className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">Delivery handover</p>
                      <p className="text-[10px] text-muted-foreground">
                        {deliveryItems.filter((i) => deliveryChecked[i.id]).length}/{deliveryItems.length} confirmed
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </button>
                </div>
              </ScrollArea>
            </div>

            {/* Active stage panel */}
            <div className="col-span-12 md:col-span-8 lg:col-span-9 overflow-hidden flex flex-col">
              <AnimatePresence mode="wait">
                {activeStageId === BRIEFING_ID ? (
                  <BikeBriefingPanel
                    key="briefing"
                    briefing={briefing}
                    loading={briefingLoading}
                    customerName={appointment?.customer_name}
                    acknowledged={briefingAck}
                    starting={starting}
                    onAcknowledge={startControl}
                  />
                ) : activeStageId === DELIVERY_ID ? (
                  <DeliveryChecklistPanel
                    key="delivery"
                    items={deliveryItems}
                    checked={deliveryChecked}
                    onToggle={(id) =>
                      setDeliveryChecked((prev) => ({ ...prev, [id]: !prev[id] }))
                    }
                  />
                ) : activeStage && activeProgress ? (
                  <motion.div
                    key={activeStage.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 flex flex-col rounded-2xl border border-border/30 bg-background/60 overflow-hidden"
                  >
                    <div className="p-4 border-b border-border/30 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("workshop.drawer.stage_label", { n: activeStage.position })}
                        </p>
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {activeStage.name}
                        </h3>
                        {activeStage.description && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {activeStage.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-wj-green/10 border border-wj-green/20 shrink-0">
                        <Clock className="h-3 w-3 text-wj-green" />
                        <span className="text-[11px] font-mono font-bold text-wj-green tabular-nums">
                          {fmt(displayStageSeconds)}
                        </span>
                      </div>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-2">
                        {activeTasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            {t("workshop.drawer.no_tasks")}
                          </p>
                        ) : (
                          activeTasks.map((task) => {
                            const checked = !!activeProgress.task_done[task.id];
                            const disabled = !!activeProgress.completed_at;
                            return (
                              <button
                                key={task.id}
                                disabled={disabled}
                                onClick={() => toggleTask(task.id)}
                                className={cn(
                                  "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                                  checked
                                    ? "bg-wj-green/10 border-wj-green/30"
                                    : "bg-background/60 border-border/30 hover:bg-muted/30",
                                  disabled && "opacity-60 cursor-default",
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                                    checked
                                      ? "bg-wj-green border-wj-green"
                                      : "border-border",
                                  )}
                                >
                                  {checked && <Check className="h-3 w-3 text-black" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p
                                      className={cn(
                                        "text-xs",
                                        checked
                                          ? "text-foreground line-through"
                                          : "text-foreground",
                                      )}
                                    >
                                      {task.label}
                                    </p>
                                    {task.is_required && (
                                      <Badge className="text-[9px] h-4 px-1.5 bg-transparent text-primary border border-primary/50">
                                        {t("workshop.drawer.required_badge")}
                                      </Badge>
                                    )}
                                  </div>
                                  {task.description && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}

                        {activeStage.requires_photo && (
                          <button
                            disabled={!!activeProgress.completed_at}
                            onClick={togglePhoto}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs transition-all",
                              activeProgress.has_photo
                                ? "bg-wj-green/10 border-wj-green/30 text-wj-green"
                                : "border-dashed border-border hover:bg-muted/30 text-muted-foreground",
                            )}
                          >
                            {activeProgress.has_photo ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Camera className="h-3.5 w-3.5" />
                            )}
                            {activeProgress.has_photo
                              ? t("workshop.drawer.photo_attached")
                              : t("workshop.drawer.photo_add", { n: activeStage.photo_min_count })}
                          </button>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="p-3 border-t border-border/30 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {activeProgress.completed_at
                          ? t("workshop.drawer.completed_in", { time: fmt(activeProgress.duration_seconds ?? 0) })
                          : t("workshop.drawer.mark_required")}
                      </span>
                      <Button
                        size="sm"
                        disabled={
                          !canCompleteActive ||
                          !!activeProgress.completed_at ||
                          saving
                        }
                        onClick={completeActiveStage}
                        className="bg-wj-green hover:bg-wj-green/90 text-black h-8 text-xs"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1" />
                        )}
                        {activeProgress.completed_at ? t("workshop.drawer.completed") : t("workshop.drawer.complete_stage")}
                      </Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Final condition assessment (SSBike) — mandatory before closing */}
              {assessBikeId ? (
                <div
                  className={cn(
                    "mt-3 rounded-2xl border p-3 flex items-center justify-between gap-3",
                    assessDone
                      ? "bg-wj-green/10 border-wj-green/30"
                      : "bg-transparent border-primary/60 ring-1 ring-primary/30",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      Final condition assessment
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {assessDone
                        ? "Battery, brakes and drivetrain rated — overall condition updated on the E-Pass."
                        : "Rate battery, brakes, drivetrain and frame to update the bike overall condition."}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Final completion */}
              <div className="mt-3 flex items-center justify-between gap-3 px-1">
                <div className="text-[11px] text-muted-foreground">
                  {t("workshop.drawer.stages_done", {
                    done: stages.filter((s) => !!progress[s.id]?.completed_at).length,
                    total: stages.length,
                  })}
                  {!allDeliveryChecked && " · delivery checklist pending"}
                  {allDeliveryChecked && assessBikeId && !assessDone && " · final condition rating pending"}
                </div>
                <Button
                  size="sm"
                  disabled={
                    !briefingAck ||
                    !allStagesCompleted ||
                    !allDeliveryChecked ||
                    saving
                  }
                  onClick={() => {
                    if (!allDeliveryChecked) {
                      setActiveStageId(DELIVERY_ID);
                      return;
                    }
                    /* Close the job with the same guided SSBike condition
                       assessment used on the E-Pass page. */
                    if (assessBikeId && !assessDone) {
                      completeAfterAssessRef.current = true;
                      setAssessOpen(true);
                      return;
                    }
                    void completeAppointment(null);
                  }}
                  className={cn(
                    "h-9 text-xs",
                    allStagesCompleted && allDeliveryChecked && briefingAck
                      ? "bg-wj-green hover:bg-wj-green/90 text-black"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  {assessBikeId && !assessDone
                    ? "Rate bike & complete"
                    : t("workshop.drawer.complete_appointment")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {assessBikeId ? (
          <BikeAssessmentDialog
            open={assessOpen}
            onOpenChange={setAssessOpen}
            bikeId={assessBikeId}
            bikeModel={briefing?.bike?.model ?? null}
            onSaved={(res) => {
              setAssessDone(true);
              setAssessOpen(false);
              if (completeAfterAssessRef.current) {
                completeAfterAssessRef.current = false;
                void completeAppointment(res?.overall ?? null);
              }
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}