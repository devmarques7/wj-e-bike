"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Play, Pause, Square, Loader2, Activity, Wrench, ShieldCheck, ChevronRight, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useShift } from "@/hooks/useShift";
import { FinishShiftDialog } from "@/components/dashboard/FinishShiftDialog";
import { useActiveWork } from "@/hooks/workshop/useActiveWork";
import { useWorkPause } from "@/lib/workshop/workPause";
import AppointmentCompletionDrawer from "@/components/dashboard/scheduling/AppointmentCompletionDrawer";
const fmtHMS = (totalSec: number) => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/**
 * Floating, draggable shift status pill for staff.
 * Shows current shift state (active / paused / idle / completed) with a live
 * timer. Click to expand and access Start / Resume / Pause / Finish actions.
 */
export function ShiftTag() {
  const {
    userId,
    row,
    loading,
    working,
    status,
    elapsedSec,
    start: handleStart,
    pause: handlePause,
    resume: handleResume,
    finish: handleFinishAction,
  } = useShift();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"shift" | "job">("shift");
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* ---- Active workshop job (global, realtime) ---- */
  const { appointment, refetch } = useActiveWork();
  const { isPaused, workNow } = useWorkPause();
  const [qcOpen, setQcOpen] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!appointment?.work_started_at) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [appointment?.work_started_at]);

  const jobStart = appointment?.work_started_at
    ? new Date(appointment.work_started_at).getTime()
    : null;
  const jobElapsed = jobStart ? Math.max(0, Math.floor((workNow() - jobStart) / 1000)) : 0;
  const hasJob = !!appointment && !!jobStart;

  const activityFeed = useMemo(() => {
    if (!appointment || !jobStart) return [] as { id: string; label: string; meta: string; tone: string }[];
    const startedAt = new Date(jobStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const feed = [
      {
        id: "started",
        label: `Job started · ${appointment.service_name ?? "Service"}`,
        meta: startedAt,
        tone: "green",
      },
    ];
    if (appointment.priority && appointment.priority !== "normal") {
      feed.push({
        id: "priority",
        label: appointment.priority === "emergency" ? "Emergency priority job" : "VIP customer job",
        meta: appointment.priority.toUpperCase(),
        tone: "amber",
      });
    }
    if (isPaused) {
      feed.push({ id: "paused", label: "Timer paused with your shift", meta: "Paused", tone: "amber" });
    }
    feed.push({
      id: "qc",
      label: "Quality Control pending completion",
      meta: fmtHMS(jobElapsed),
      tone: "green",
    });
    return feed;
  }, [appointment, jobStart, isPaused, jobElapsed]);

  const elRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragMoved = useRef(false);

  // Restore saved position
  useEffect(() => {
    try {
      const raw = localStorage.getItem("wj.shiftTag.pos");
      if (raw) setPos(JSON.parse(raw));
    } catch {}
  }, []);

  // Default position (top-right, slightly below header) + bounds
  useEffect(() => {
    const PAD = 16;
    const compute = () => {
      const el = elRef.current;
      const w = el?.offsetWidth ?? 170;
      const h = el?.offsetHeight ?? 32;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setBounds({
        left: PAD,
        top: PAD,
        right: Math.max(PAD, vw - w - PAD),
        bottom: Math.max(PAD, vh - h - PAD),
      });
      setPos((p) => {
        if (!p) return { x: Math.max(PAD, vw - w - PAD), y: PAD + 56 };
        return {
          x: Math.min(Math.max(p.x, PAD), Math.max(PAD, vw - w - PAD)),
          y: Math.min(Math.max(p.y, PAD), Math.max(PAD, vh - h - PAD)),
        };
      });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Collapse when clicking outside the pill / panel
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = elRef.current;
      const target = e.target as HTMLElement | null;
      // Ignore clicks inside the confirm dialog (it portals to body)
      if (target?.closest("[role='alertdialog']")) return;
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const dotClass = {
    idle: "bg-muted-foreground/50",
    active: "bg-wj-green",
    paused: "bg-amber-400",
    completed: "bg-white",
  }[status];

  const label = {
    idle: "Not started",
    active: "Active",
    paused: "Paused",
    completed: "Completed",
  }[status];

  const handleFinish = async () => {
    setConfirmOpen(true);
  };

  if (typeof document === "undefined") return null;
  if (!userId) return null;

  return createPortal(
    <motion.div
      ref={elRef}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={bounds}
      onDragStart={() => {
        setDragging(true);
        dragMoved.current = false;
      }}
      onDrag={(_, info) => {
        if (Math.abs(info.offset.x) > 3 || Math.abs(info.offset.y) > 3) dragMoved.current = true;
      }}
      onDragEnd={(_, info) => {
        setDragging(false);
        const next = {
          x: Math.min(Math.max((pos?.x ?? 0) + info.offset.x, bounds.left), bounds.right),
          y: Math.min(Math.max((pos?.y ?? 0) + info.offset.y, bounds.top), bounds.bottom),
        };
        setPos(next);
        try { localStorage.setItem("wj.shiftTag.pos", JSON.stringify(next)); } catch {}
      }}
      animate={pos ? { x: pos.x, y: pos.y } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
      style={{ position: "fixed", left: 0, top: 0, touchAction: "none" }}
      className="z-[9999] hidden sm:flex flex-col items-stretch"
    >
      {/* Pill */}
      <div
        className={cn(
          "group flex items-center gap-2 rounded-full border border-border/40 bg-background/60 backdrop-blur px-3 py-1.5 shadow-lg shadow-black/10 transition-colors duration-300 hover:border-wj-green/40",
          status === "completed" && "bg-wj-green border-wj-green text-white hover:border-white/40",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (dragMoved.current) return;
            if (open && tab === "shift") setOpen(false);
            else {
              setTab("shift");
              setOpen(true);
            }
          }}
          className="flex items-center gap-2"
        >
        <GripVertical className="h-3 w-3 text-muted-foreground/60 -ml-1" />
        <span className="relative flex h-2 w-2">
          {status === "active" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wj-green opacity-60" />
          )}
          {status === "completed" && (
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-white opacity-40" />
          )}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotClass)} />
        </span>
        <Activity className={cn("h-3.5 w-3.5 text-muted-foreground", status === "completed" && "text-white")} />
        <span className={cn("text-xs font-medium tabular-nums min-w-[64px] text-left", status === "completed" ? "text-white" : "text-foreground")}>
          {loading ? "—" : fmtHMS(elapsedSec)}
        </span>
        <span className={cn("text-[10px] uppercase tracking-wider hidden md:inline", status === "completed" ? "text-white/80" : "text-muted-foreground")}>
          {label}
        </span>
        </button>

        {/* Active job timer — extends the pill in width */}
        <AnimatePresence initial={false}>
          {hasJob && (
            <motion.span
              key="job"
              initial={{ width: 0, opacity: 0, marginLeft: 0 }}
              animate={{ width: "auto", opacity: 1, marginLeft: 4 }}
              exit={{ width: 0, opacity: 0, marginLeft: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <span className="h-4 w-px bg-border/60 shrink-0" />
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (dragMoved.current) return;
                  if (open && tab === "job") setOpen(false);
                  else {
                    setTab("job");
                    setOpen(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 py-0.5 border shrink-0 transition-colors",
                  open && tab === "job" && "ring-1 ring-wj-green/50",
                  isPaused
                    ? "bg-amber-500/10 border-amber-400/40"
                    : "bg-wj-green/10 border-wj-green/30",
                )}
              >
                <motion.span
                  animate={isPaused ? { rotate: 0 } : { rotate: [0, -18, 12, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  className="flex"
                >
                  <Wrench className={cn("h-3 w-3", isPaused ? "text-amber-400" : "text-wj-green")} />
                </motion.span>
                <span
                  className={cn(
                    "text-xs font-mono font-bold tabular-nums",
                    isPaused ? "text-amber-400" : "text-wj-green",
                  )}
                >
                  {fmtHMS(jobElapsed)}
                </span>
              </motion.button>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "mt-2 rounded-2xl border p-2 flex flex-col gap-1.5 min-w-[200px] shadow-xl",
              status === "completed"
                ? "bg-wj-green border-wj-green/40 shadow-wj-green/30 text-white"
                : "bg-background/80 backdrop-blur-xl border-border/40 shadow-black/20",
            )}
          >
            {/* Tabs — one per timer */}
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-muted/40 relative">
              {(["shift", ...(hasJob ? (["job"] as const) : [])] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="relative flex-1 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-medium transition-colors"
                >
                  {tab === t && (
                    <motion.span
                      layoutId="shifttag-tab"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-background shadow-sm border border-border/40"
                    />
                  )}
                  <span className={cn("relative", tab === t ? "text-foreground" : "text-muted-foreground")}>
                    {t === "shift" ? "Shift" : "Job"}
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {tab === "shift" ? (
                <motion.div
                  key="tab-shift"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-1.5 w-[280px]"
                >
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Today's shift
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        status === "active" && "text-wj-green",
                        status === "paused" && "text-amber-400",
                        status === "completed" && "text-wj-green",
                        status === "idle" && "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                  </div>

                  {/* What is happening inside the shift timer */}
                  <div className="flex flex-col gap-1 px-1">
                    <DetailRow label="Elapsed" value={loading ? "—" : fmtHMS(elapsedSec)} highlight />
                    <DetailRow
                      label="Clock in"
                      value={
                        row?.clock_in
                          ? new Date(row.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"
                      }
                    />
                    <DetailRow
                      label="Scheduled"
                      value={row?.scheduled_minutes ? `${Math.round(row.scheduled_minutes / 60)}h` : "—"}
                    />
                    <DetailRow
                      label="Remaining"
                      value={
                        row?.scheduled_minutes
                          ? fmtHMS(Math.max(0, row.scheduled_minutes * 60 - elapsedSec))
                          : "—"
                      }
                    />
                    <DetailRow label="Timer" value={status === "paused" ? "Frozen" : status === "active" ? "Counting" : "Stopped"} />
                  </div>

                  {/* Progress vs. scheduled */}
                  {!!row?.scheduled_minutes && (
                    <div className="px-2">
                      <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, (elapsedSec / (row.scheduled_minutes * 60)) * 100)}%`,
                          }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className={cn("h-full rounded-full", status === "paused" ? "bg-amber-400" : "bg-wj-green")}
                        />
                      </div>
                    </div>
                  )}

                  {status === "idle" && (
                    <ActionButton onClick={handleStart} working={working} icon={Play} label="Start" tone="green" />
                  )}
                  {status === "active" && (
                    <>
                      <ActionButton onClick={handlePause} working={working} icon={Pause} label="Pause" tone="amber" />
                      <ActionButton onClick={handleFinish} working={working} icon={Square} label="Finish" tone="red" />
                    </>
                  )}
                  {status === "paused" && (
                    <>
                      <ActionButton onClick={handleResume} working={working} icon={Play} label="Resume" tone="green" />
                      <ActionButton onClick={handleFinish} working={working} icon={Square} label="Finish" tone="red" />
                    </>
                  )}
                  {status === "completed" && (
                    <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">
                      Shift completed for today.
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="tab-job"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-1.5 w-[280px]"
                >
                  <div className="flex items-center gap-1.5 px-2 pt-1">
                    <Bell className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex-1">
                      Live activity
                    </span>
                    <span className={cn("text-[10px] font-medium", isPaused ? "text-amber-400" : "text-wj-green")}>
                      {isPaused ? "Paused" : "Running"}
                    </span>
                  </div>

                  {/* What is happening inside the job timer */}
                  <div className="flex flex-col gap-1 px-1">
                    <DetailRow label="Elapsed" value={fmtHMS(jobElapsed)} highlight />
                    <DetailRow
                      label="Started"
                      value={
                        jobStart
                          ? new Date(jobStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"
                      }
                    />
                    <DetailRow label="Service" value={appointment?.service_name ?? "—"} />
                    <DetailRow
                      label="Planned"
                      value={appointment?.duration_minutes ? `${appointment.duration_minutes} min` : "—"}
                    />
                  </div>

                  <div className="flex flex-col gap-1 px-1">
                    {activityFeed.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.22 }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-muted/30"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            item.tone === "amber" ? "bg-amber-400" : "bg-wj-green animate-pulse",
                          )}
                        />
                        <span className="text-[11px] text-foreground truncate flex-1">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {item.meta}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Process ongoing → opens Quality Control */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      setQcOpen(true);
                      setOpen(false);
                    }}
                    className="mt-1 flex items-center gap-2.5 rounded-xl border border-wj-green/40 bg-wj-green/10 px-2.5 py-2 text-left hover:bg-wj-green/20 transition-colors"
                  >
                    <span className="relative w-8 h-8 rounded-lg bg-wj-green/15 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4 text-wj-green" />
                      <span
                        className={cn(
                          "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full",
                          isPaused ? "bg-amber-400" : "bg-wj-green animate-ping",
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                        Process ongoing
                      </span>
                      <span className="block text-xs font-medium text-foreground truncate mt-0.5">
                        {appointment?.customer_name ?? appointment?.service_name ?? "Appointment"}
                      </span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-wj-green shrink-0" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <FinishShiftDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={async () => {
          await handleFinishAction();
          setOpen(false);
        }}
        working={working}
      />

      <AppointmentCompletionDrawer
        appointment={appointment}
        open={qcOpen && !!appointment}
        onOpenChange={setQcOpen}
        onCompleted={() => {
          setQcOpen(false);
          refetch();
        }}
      />
    </motion.div>,
    document.body,
  );
}

function ActionButton({
  onClick,
  working,
  icon: Icon,
  label,
  tone,
}: {
  onClick: () => void;
  working: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "green" | "amber" | "red";
}) {
  const toneCls = {
    green: "hover:bg-wj-green/10 hover:text-wj-green",
    amber: "hover:bg-amber-500/10 hover:text-amber-400",
    red: "hover:bg-destructive/10 hover:text-destructive",
  }[tone];
  return (
    <button
      type="button"
      disabled={working}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-foreground transition-colors disabled:opacity-50",
        toneCls,
      )}
    >
      {working ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

export default ShiftTag;