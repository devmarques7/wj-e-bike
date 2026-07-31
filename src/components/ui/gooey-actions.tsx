import * as React from "react";
import { cn } from "@/lib/utils";

export interface GooeyAction {
  /** Stable id passed back to `onSelect`. */
  id: string;
  /** Accessible name + hover/focus label chip text. */
  label: string;
  /** Optional glyph; falls back to the label initial. */
  icon?: React.ReactNode;
}

export interface GooeyActionsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  actions: GooeyAction[];
  /** Distance from the core to each satellite, in px. */
  radius?: number;
  /** Arc the satellites spread across, in degrees (−90° is up). */
  arc?: [number, number];
  /** Per-satellite launch delay, in ms. */
  stagger?: number;
  stiffness?: number;
  damping?: number;
  /** Pointer distance within which a satellite leans toward the cursor. */
  magnetRange?: number;
  /** Accessible name + core caption. */
  label?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (id: string) => void;
  /** Horizontal anchor of the core inside the box (0–1). */
  coreX?: number;
  /** Vertical anchor of the core inside the box (0–1). */
  coreY?: number;
  reducedMotion?: boolean;
  /** Require a press-and-hold on the core before the satellites bloom. */
  holdToOpen?: boolean;
  /** Hold duration in ms before opening (default 1000). */
  holdDelay?: number;
}

/* ---------------------------------- physics -------------------------------- */

interface Spring {
  x: number;
  v: number;
}
const mkSpring = (x = 0): Spring => ({ x, v: 0 });

function spring(s: Spring, target: number, k: number, c: number, dt: number) {
  const n = dt > 0.012 ? Math.ceil(dt / 0.008) : 1;
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (-k * (s.x - target) - c * s.v) * h;
    s.x += s.v * h;
  }
  return s.x;
}

const CORE_PX = 66;
const SAT_PX = 46;
const MAGNET_PULL = 0.35;

interface SatState {
  ang: number;
  x: Spring;
  y: Spring;
  s: Spring;
}

function useReducedMotionPref() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * GooeyActions — a floating action button that blooms into satellites through a
 * gooey metaball merge: solid blobs animate under an SVG blur + alpha-contrast
 * filter while crisp icons ride an unfiltered twin layer sharing the same
 * transforms. Underdamped springs, per-satellite stagger and pointer magnetism.
 */
export function GooeyActions({
  actions,
  radius = 112,
  arc = [-165, -15],
  stagger = 45,
  stiffness = 230,
  damping = 13,
  magnetRange = 56,
  label = "Actions",
  open,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  coreX = 0.5,
  coreY = 0.62,
  reducedMotion,
  holdToOpen = false,
  holdDelay = 1000,
  className,
  style,
  ...props
}: GooeyActionsProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const fabRef = React.useRef<HTMLButtonElement>(null);
  const coreBlobRef = React.useRef<HTMLDivElement>(null);
  const satBlobsRef = React.useRef<Array<HTMLDivElement | null>>([]);
  const satBtnsRef = React.useRef<Array<HTMLButtonElement | null>>([]);
  const labelRef = React.useRef<HTMLDivElement>(null);
  const pointerRef = React.useRef({ x: -1e4, y: -1e4, inside: false });
  const focusedRef = React.useRef(-1);
  const nowRef = React.useRef(0);
  const toggleAtRef = React.useRef(-1e4);
  const hoverIdxRef = React.useRef(-1);
  const holdTimerRef = React.useRef<number | null>(null);
  const holdingRef = React.useRef(false);

  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const filterId = `wj-goo-${uid}`;
  const menuId = `wj-goo-menu-${uid}`;

  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = isControlled ? (open as boolean) : internalOpen;
  const setIsOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const [activeIdx, setActiveIdx] = React.useState(0);
  const openRef = React.useRef(isOpen);
  const systemReduced = useReducedMotionPref();
  const staticMode = reducedMotion === true || systemReduced;

  const count = actions.length;
  const [a0, a1] = arc;

  const params = React.useRef({ radius, stagger, stiffness, damping, magnetRange, coreX, coreY });
  params.current = { radius, stagger, stiffness, damping, magnetRange, coreX, coreY };


  const satsRef = React.useRef<SatState[]>([]);
  const ringKeyRef = React.useRef("");
  const ringKey = `${count}:${a0}:${a1}`;
  if (ringKeyRef.current !== ringKey) {
    ringKeyRef.current = ringKey;
    satsRef.current = Array.from({ length: count }, (_, i) => ({
      ang: ((count === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * (i / (count - 1))) * Math.PI) / 180,
      x: mkSpring(0),
      y: mkSpring(0),
      s: mkSpring(0.6),
    }));
  }

  const center = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return { x: 0, y: 0 };
    return { x: root.clientWidth * params.current.coreX, y: root.clientHeight * params.current.coreY };
  }, []);

  const applyOne = React.useCallback((i: number) => {
    const s = satsRef.current[i];
    if (!s) return;
    const tr = `translate(-50%,-50%) translate3d(${s.x.x.toFixed(2)}px,${s.y.x.toFixed(
      2,
    )}px,0) scale(${s.s.x.toFixed(3)})`;
    const blob = satBlobsRef.current[i];
    const btn = satBtnsRef.current[i];
    if (blob) blob.style.transform = tr;
    if (btn) {
      btn.style.transform = tr;
      btn.style.opacity = Math.hypot(s.x.x, s.y.x) > SAT_PX ? "1" : "0";
    }
  }, []);

  const showLabelFor = React.useCallback(
    (i: number) => {
      const el = labelRef.current;
      const s = satsRef.current[i];
      if (!el || !s) return;
      const c = center();
      const next = actions[i]?.label ?? "";
      if (el.textContent !== next) el.textContent = next;
      el.style.transform = `translate3d(${(c.x + s.x.x - el.offsetWidth / 2).toFixed(1)}px,${(
        c.y +
        s.y.x -
        54
      ).toFixed(1)}px,0)`;
      el.style.opacity = "1";
    },
    [actions, center],
  );

  const hideLabel = React.useCallback(() => {
    if (labelRef.current) labelRef.current.style.opacity = "0";
  }, []);

  const layoutInstant = React.useCallback(
    (opened: boolean) => {
      const r = params.current.radius;
      satsRef.current.forEach((s, i) => {
        s.x.x = opened ? Math.cos(s.ang) * r : 0;
        s.y.x = opened ? Math.sin(s.ang) * r : 0;
        s.s.x = opened ? 1 : 0.6;
        s.x.v = s.y.v = s.s.v = 0;
        applyOne(i);
      });
    },
    [applyOne],
  );

  React.useEffect(() => {
    openRef.current = isOpen;
    toggleAtRef.current = nowRef.current;
    if (!isOpen) hideLabel();
    if (staticMode) layoutInstant(isOpen);
  }, [isOpen, staticMode, layoutInstant, hideLabel]);

  React.useEffect(() => {
    if (staticMode) return;
    const breathe = mkSpring(1);
    let raf = 0;
    let last = 0;
    let start = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!start) start = now;
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0) || dt > 0.05) dt = 0.016;
      const t = (now - start) / 1000;
      nowRef.current = t;

      const cfg = params.current;
      const opened = openRef.current;
      const p = pointerRef.current;
      const c = center();
      const staggerSec = cfg.stagger / 1000;

      let hoverAny = -1;
      for (let i = 0; i < satsRef.current.length; i++) {
        const s = satsRef.current[i];
        const mounted = opened && t - toggleAtRef.current >= i * staggerSec;
        let tx = mounted ? Math.cos(s.ang) * cfg.radius : 0;
        let ty = mounted ? Math.sin(s.ang) * cfg.radius : 0;
        let ts = mounted ? 1 : 0.6;

        if (opened && p.inside && cfg.magnetRange > 0) {
          const dx = p.x - (c.x + s.x.x);
          const dy = p.y - (c.y + s.y.x);
          const d = Math.hypot(dx, dy);
          if (d < cfg.magnetRange) {
            const pull = 1 - d / cfg.magnetRange;
            tx += dx * MAGNET_PULL * pull;
            ty += dy * MAGNET_PULL * pull;
            ts = 1 + 0.16 * pull;
            if (hoverAny < 0) hoverAny = i;
          }
        }

        spring(s.x, tx, cfg.stiffness, cfg.damping, dt);
        spring(s.y, ty, cfg.stiffness, cfg.damping, dt);
        spring(s.s, ts, 300, 20, dt);
        applyOne(i);
      }

      if (hoverAny >= 0) showLabelFor(hoverAny);
      else if (focusedRef.current >= 0) showLabelFor(focusedRef.current);
      else hideLabel();
      hoverIdxRef.current = hoverAny;

      spring(breathe, opened ? 1.06 : 1 + Math.sin(t * 1.6) * 0.035, 200, 18, dt);
      const coreTr = `translate(-50%,-50%) scale(${breathe.x.toFixed(3)})`;
      if (coreBlobRef.current) coreBlobRef.current.style.transform = coreTr;
      if (fabRef.current) fabRef.current.style.transform = coreTr;
    };

    last = performance.now();
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [staticMode, ringKey, applyOne, center, showLabelFor, hideLabel]);

  const track = (e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    pointerRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
  };
  const release = () => {
    pointerRef.current = { x: -1e4, y: -1e4, inside: false };
  };

  const clearHold = React.useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // Press-and-hold on the core, then drag sideways onto an action and release.
  const onCorePointerDown = (e: React.PointerEvent) => {
    if (!holdToOpen) return;
    e.preventDefault();
    e.stopPropagation();
    const rootEl = rootRef.current;
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (rootEl) {
      const r = rootEl.getBoundingClientRect();
      pointerRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    }
    holdingRef.current = false;
    clearHold();
    holdTimerRef.current = window.setTimeout(() => {
      holdingRef.current = true;
      setIsOpen(true);
    }, holdDelay);
  };

  const onCorePointerMove = (e: React.PointerEvent) => {
    if (!holdToOpen) return;
    track(e);
  };

  const onCorePointerUp = (e: React.PointerEvent) => {
    if (!holdToOpen) return;
    clearHold();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (holdingRef.current) {
      const idx = hoverIdxRef.current;
      if (idx >= 0 && actions[idx]) onSelect?.(actions[idx].id);
      holdingRef.current = false;
      setIsOpen(false);
      release();
    }
  };

  React.useEffect(() => clearHold, [clearHold]);

  const focusSat = (i: number) => {
    setActiveIdx(i);
    satBtnsRef.current[i]?.focus();
  };

  const closeAndRestore = () => {
    setIsOpen(false);
    fabRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || count === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusSat((activeIdx + 1) % count);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusSat((activeIdx - 1 + count) % count);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusSat(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusSat(count - 1);
    }
  };

  const topPct = `${coreY * 100}%`;
  const leftPct = `${coreX * 100}%`;


  return (
    <div
      ref={rootRef}
      className={cn("relative select-none", className)}
      style={{ width: 300, height: 260, ...style }}
      onPointerMove={track}
      onPointerLeave={release}
      onKeyDown={(e) => {
        if (e.key === "Escape" && isOpen) {
          e.stopPropagation();
          closeAndRestore();
        }
      }}
      {...props}
    >
      {/* Goo filter: blur + alpha contrast */}
      <svg aria-hidden className="absolute h-0 w-0">
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Filtered blob field */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ filter: `url(#${filterId})` }}
      >
        <div
          ref={coreBlobRef}
          className="absolute rounded-full bg-wj-green"
          style={{
            left: "50%",
            top: topPct,
            width: CORE_PX,
            height: CORE_PX,
            transform: "translate(-50%,-50%)",
            willChange: "transform",
          }}
        />
        {actions.map((action, i) => (
          <div
            key={action.id}
            ref={(el) => {
              satBlobsRef.current[i] = el;
            }}
            className="absolute rounded-full bg-wj-green"
            style={{
              left: "50%",
              top: topPct,
              width: SAT_PX,
              height: SAT_PX,
              transform: "translate(-50%,-50%) scale(0.6)",
              willChange: "transform",
            }}
          />
        ))}
      </div>

      {/* Unfiltered twin layer: real buttons + crisp icons */}
      <div className="pointer-events-none absolute inset-0">
        <div role="menu" id={menuId} aria-label={label} onKeyDown={onMenuKeyDown}>
          {actions.map((action, i) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              ref={(el) => {
                satBtnsRef.current[i] = el;
              }}
              data-action={action.id}
              disabled={!isOpen}
              tabIndex={isOpen && i === Math.min(activeIdx, count - 1) ? 0 : -1}
              aria-label={action.label}
              onFocus={() => {
                focusedRef.current = i;
                setActiveIdx(i);
                showLabelFor(i);
              }}
              onBlur={() => {
                if (focusedRef.current === i) focusedRef.current = -1;
                hideLabel();
              }}
              onClick={() => {
                onSelect?.(action.id);
                closeAndRestore();
              }}
              className={cn(
                "absolute grid cursor-pointer place-items-center rounded-full border-0 p-0 opacity-0 text-primary-foreground",
                "[&_svg]:h-[20px] [&_svg]:w-[20px]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wj-green",
                staticMode && "transition-opacity duration-200",
              )}
              style={{
                left: "50%",
                top: topPct,
                width: SAT_PX,
                height: SAT_PX,
                background: "transparent",
                transform: "translate(-50%,-50%) scale(0.6)",
                pointerEvents: isOpen ? "auto" : "none",
                willChange: "transform",
              }}
            >
              {action.icon ?? (
                <span className="text-sm font-semibold">
                  {action.label.slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          ref={fabRef}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-label={label}
          onClick={(event) => {
            if (holdToOpen) return;
            const next = !isOpen;
            setIsOpen(next);
            if (next && event.detail === 0) {
              setActiveIdx(0);
              requestAnimationFrame(() => satBtnsRef.current[0]?.focus());
            }
          }}
          onPointerDown={onCorePointerDown}
          onPointerMove={onCorePointerMove}
          onPointerUp={onCorePointerUp}
          onPointerCancel={onCorePointerUp}
          className={cn(
            "pointer-events-auto absolute grid cursor-pointer place-items-center rounded-full border-0 p-0",
            "text-primary-foreground text-xs font-medium tracking-[0.18em] uppercase touch-none",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wj-green",
          )}
          style={{
            left: "50%",
            top: topPct,
            width: CORE_PX,
            height: CORE_PX,
            background: "transparent",
            transform: "translate(-50%,-50%)",
            willChange: "transform",
          }}
        >
          {label}
        </button>
      </div>

      {/* Hover / focus label chip */}
      <div
        ref={labelRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full border border-border/50 bg-card/80 px-3 py-1 text-[11px] text-foreground opacity-0 backdrop-blur-md transition-opacity duration-150 whitespace-nowrap"
      />
    </div>
  );
}

GooeyActions.displayName = "GooeyActions";

export default GooeyActions;