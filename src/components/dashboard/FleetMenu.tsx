import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { QrCode, CalendarPlus, Pause, Play, Plus } from "lucide-react";
import { GooeyActions } from "@/components/ui/gooey-actions";
import ScanEPassDialog from "@/components/dashboard/wallet/ScanEPassDialog";
import useShift from "@/hooks/useShift";

/**
 * Fleet — draggable floating quick-action dial (gooey bloom) with the three
 * workshop essentials: scan an E-Pass, book an appointment and the shift
 * start/pause toggle.
 */
export interface FleetMenuProps {
  /** Staff-only: shows the shift start/pause action in the dial. */
  showShift?: boolean;
}

export default function FleetMenu({ showShift = true }: FleetMenuProps) {
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const { status, start, pause, resume, working } = useShift();

  const shiftRunning = status === "active";
  const shiftLabel = working
    ? "Updating shift…"
    : shiftRunning
      ? "Pause shift"
      : status === "paused"
        ? "Resume shift"
        : "Start shift";

  const toggleShift = () => {
    if (working) return;
    if (shiftRunning) pause();
    else if (status === "paused") resume();
    else start();
  };

  /**
   * Keeps the core Fleet button fully inside the viewport: measures the real
   * button rect and nudges the wrapper offsets until it fits with a margin.
   */
  const clampIntoViewport = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const core = wrapper.querySelector<HTMLElement>('button[aria-haspopup="menu"]');
    if (!core) return;
    const rect = core.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const margin = 12;
    let dx = 0;
    let dy = 0;
    if (rect.left < margin) dx = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
    if (rect.top < margin) dy = margin - rect.top;
    else if (rect.bottom > window.innerHeight - margin) dy = window.innerHeight - margin - rect.bottom;

    if (dx) x.set(x.get() + dx);
    if (dy) y.set(y.get() + dy);
  }, [x, y]);

  useEffect(() => {
    clampIntoViewport();
    const onResize = () => clampIntoViewport();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [clampIntoViewport]);

  // Memoised so unrelated re-renders never hand GooeyActions a fresh array.
  const actions = useMemo(() => {
    const base = [
      { id: "scan", label: "Scan E-Pass", icon: <QrCode /> },
      { id: "book", label: "New appointment", icon: <CalendarPlus /> },
    ];
    if (!showShift) return base;
    return [
      ...base,
      { id: "shift", label: shiftLabel, icon: shiftRunning ? <Pause /> : <Play /> },
    ];
  }, [shiftLabel, shiftRunning, showShift]);

  const onSelect = (id: string) => {
    if (id === "scan") setScanOpen(true);
    if (id === "book") navigate("/dashboard/staff/schedule");
    if (id === "shift") toggleShift();
  };

  const handleOpenChange = (next: boolean) => {
    // The ref changes synchronously, so the active pointermove handler freezes
    // the Fleet button on the exact frame the hold blooms actions.
    menuOpenRef.current = next;
    setMenuOpen(next);
  };

  const startFreeDrag = (event: PointerEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper || menuOpenRef.current) return false;

    const pointerId = event.pointerId;
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = x.get();
    const startY = y.get();

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId || menuOpenRef.current) return;
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - originX;
      const dy = moveEvent.clientY - originY;
      x.set(startX + dx);
      y.set(startY + dy);
      // Hard guarantee: the core never leaves the visible viewport.
      clampIntoViewport();
    };

    const cleanup = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      clampIntoViewport();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    return true;
  };

  return (
    <>
      <motion.div
        ref={wrapperRef}
        style={{ x, y }}
        className="fixed bottom-8 right-8 z-[2147483000] cursor-grab active:cursor-grabbing"
      >
        <GooeyActions
          label="Fleet"
          coreIcon={<Plus className="h-6 w-6" strokeWidth={2.2} />}
          actions={actions}
          holdToOpen
          holdDelay={800}
          onPressDrag={startFreeDrag}
          radius={74}
          arc={[-160, -80]}
          magnetRange={46}
          coreX={1}
          coreY={1}
          open={menuOpen}
          onOpenChange={handleOpenChange}
          style={{ width: "80vw", height: "80vh" }}
          onSelect={onSelect}
        />
      </motion.div>

      <ScanEPassDialog open={scanOpen} onOpenChange={setScanOpen} />
    </>
  );
}