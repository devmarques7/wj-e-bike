"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPin, ArrowUpRight, GripVertical, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSystemStatus, formatCountdown } from "@/hooks/useSystemStatus";
import { useNavigate } from "react-router-dom";

interface LocationTagProps {
  city?: string;
  country?: string;
  timezone?: string;
  className?: string;
}

/**
 * Compact pill showing the current store location.
 * Alternates with the local time every minute, and shows the time on hover.
 */
export function LocationTag({
  city = "Amsterdam",
  country = "NL",
  timezone = "Europe/Amsterdam",
}: LocationTagProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [now, setNow] = useState(Date.now());
  const [rotationIdx, setRotationIdx] = useState(0);
  const { statuses, dismissStatus } = useSystemStatus();
  const navigate = useNavigate();
  const elRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Restore saved position
  useEffect(() => {
    try {
      const raw = localStorage.getItem("wj.locationTag.pos");
      if (raw) setPos(JSON.parse(raw));
    } catch {}
  }, []);

  // Default position: top-right corner, and keep bounds in sync
  useEffect(() => {
    const PAD = 16;
    const compute = () => {
      const el = elRef.current;
      const w = el?.offsetWidth ?? 160;
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

  useEffect(() => {
    const updateTime = () => {
      try {
        setCurrentTime(
          new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: timezone,
          }),
        );
      } catch {
        setCurrentTime(
          new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        );
      }
    };
    updateTime();
    const tick = setInterval(updateTime, 1000);
    return () => clearInterval(tick);
  }, [timezone]);

  useEffect(() => {
    // toggle every 60s
    const swap = setInterval(() => setShowTime((s) => !s), 60_000);
    return () => clearInterval(swap);
  }, []);

  // Rotate through statuses + base slot every 6s
  useEffect(() => {
    if (statuses.length === 0) return;
    const t = setInterval(() => {
      setRotationIdx((i) => (i + 1) % (statuses.length + 1));
    }, 6000);
    return () => clearInterval(t);
  }, [statuses.length]);

  // Live tick for countdowns
  useEffect(() => {
    if (!statuses.some((s) => s.countdownTo)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [statuses]);

  const activeStatus =
    statuses.length > 0 && rotationIdx < statuses.length
      ? statuses[rotationIdx]
      : null;
  const displayTime = !activeStatus && (isHovered || showTime);

  const toneClasses: Record<string, string> = {
    info: "border-wj-green/40 text-foreground",
    success: "border-wj-green/60 text-wj-green",
    warning: "border-amber-400/50 text-amber-300",
    urgent: "border-red-500/60 text-red-300",
  };
  const toneDot: Record<string, string> = {
    info: "bg-wj-green",
    success: "bg-wj-green",
    warning: "bg-amber-400",
    urgent: "bg-red-500",
  };
  const StatusIcon = activeStatus?.icon;

  const handleActivate = () => {
    // If there are active statuses, clicking the pill expands the panel
    // to show all ongoing activities. Without statuses, this is a no-op.
    if (statuses.length > 0) {
      setExpanded((v) => !v);
      return;
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      ref={elRef}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={bounds}
      onDragStart={() => setDragging(true)}
      onDragEnd={(_, info) => {
        setDragging(false);
        const next = {
          x: Math.min(Math.max((pos?.x ?? 0) + info.offset.x, bounds.left), bounds.right),
          y: Math.min(Math.max((pos?.y ?? 0) + info.offset.y, bounds.top), bounds.bottom),
        };
        setPos(next);
        try { localStorage.setItem("wj.locationTag.pos", JSON.stringify(next)); } catch {}
      }}
      animate={pos ? { x: pos.x, y: pos.y } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: "fixed", left: 0, top: 0, touchAction: "none" }}
      className={cn(
        "group z-[9999] hidden sm:flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-3 py-1.5 shadow-lg shadow-black/10 transition-colors duration-500",
        activeStatus
          ? toneClasses[activeStatus.tone ?? "info"]
          : "border-border/40 hover:border-wj-green/40",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/60 -ml-1" />
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            activeStatus ? toneDot[activeStatus.tone ?? "info"] : "bg-wj-green",
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            activeStatus ? toneDot[activeStatus.tone ?? "info"] : "bg-wj-green",
          )}
        />
      </span>
      {activeStatus && StatusIcon ? (
        <StatusIcon className="h-3.5 w-3.5" />
      ) : (
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <button
        type="button"
        onClick={(e) => {
          if (dragging) return;
          e.stopPropagation();
          handleActivate();
        }}
        className="relative h-4 overflow-hidden min-w-[90px] max-w-[260px] text-left"
        title={activeStatus?.detail}
      >
        <AnimatePresence mode="wait" initial={false}>
          {activeStatus ? (
            <motion.span
              key={`status-${activeStatus.id}-${now - (now % 1000)}`}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 text-xs font-medium truncate"
            >
              {activeStatus.label}
              {activeStatus.countdownTo && (
                <span className="ml-1.5 opacity-70 tabular-nums">
                  · {formatCountdown(activeStatus.countdownTo, now)}
                </span>
              )}
            </motion.span>
          ) : displayTime ? (
            <motion.span
              key="time"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 text-xs font-medium text-foreground tabular-nums"
            >
              {currentTime}
            </motion.span>
          ) : (
            <motion.span
              key="loc"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 text-xs font-medium text-foreground"
            >
              {city}, {country}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {activeStatus ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissStatus(activeStatus.id);
          }}
          className="text-muted-foreground/70 hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      ) : (
        <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
      {statuses.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (dragging) return;
            setExpanded((v) => !v);
          }}
          className="text-muted-foreground/70 hover:text-foreground transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      )}
      <AnimatePresence>
        {expanded && statuses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-[300px] rounded-2xl border border-border/40 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-2 z-[10000]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Ongoing ({statuses.length})
              </span>
            </div>
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {statuses.map((s) => {
                const Icon = s.icon ?? MapPin;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors cursor-pointer hover:bg-muted/40",
                      toneClasses[s.tone ?? "info"],
                    )}
                    onClick={() => {
                      if (s.onClick) s.onClick();
                      else if (s.href) {
                        navigate(s.href);
                        setExpanded(false);
                      }
                    }}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full",
                        toneDot[s.tone ?? "info"],
                        "bg-opacity-20",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium truncate">
                          {s.label}
                        </p>
                        {s.countdownTo && (
                          <span className="text-[10px] tabular-nums opacity-80 shrink-0">
                            {formatCountdown(s.countdownTo, now)}
                          </span>
                        )}
                      </div>
                      {s.detail && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {s.detail}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissStatus(s.id);
                      }}
                      className="text-muted-foreground/70 hover:text-foreground transition-colors shrink-0"
                      aria-label="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

export default LocationTag;