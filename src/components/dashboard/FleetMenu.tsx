import { useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { QrCode, CalendarPlus, Pause, Play, Plus } from "lucide-react";
import { GooeyActions } from "@/components/ui/gooey-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import EPassScanner from "@/components/dashboard/wallet/EPassScanner";
import useShift from "@/hooks/useShift";

/**
 * Fleet — draggable floating quick-action dial (gooey bloom) with the three
 * workshop essentials: scan an E-Pass, book an appointment and the shift
 * start/pause toggle.
 */
export default function FleetMenu() {
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

  const actions = [
    { id: "scan", label: "Scan E-Pass", icon: <QrCode /> },
    { id: "book", label: "New appointment", icon: <CalendarPlus /> },
    { id: "shift", label: shiftLabel, icon: shiftRunning ? <Pause /> : <Play /> },
  ];

  const onSelect = (id: string) => {
    if (id === "scan") setScanOpen(true);
    if (id === "book") navigate("/dashboard/staff/schedule");
    if (id === "shift") toggleShift();
  };

  const handleOpenChange = (next: boolean) => {
    // The ref changes synchronously, so the active pointermove handler freezes
    // the Fleet button on the exact frame the five-second hold blooms actions.
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
    const rect = wrapper.getBoundingClientRect();

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId || menuOpenRef.current) return;
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - originX;
      const dy = moveEvent.clientY - originY;
      // Keep the draggable core visible while allowing movement anywhere in
      // the viewport. The large action field follows the same translation.
      const nextLeft = rect.left + dx;
      const nextTop = rect.top + dy;
      const minVisible = 40;
      const clampedDx = Math.min(
        window.innerWidth - minVisible - rect.left,
        Math.max(minVisible - rect.right, dx),
      );
      const clampedDy = Math.min(
        window.innerHeight - minVisible - rect.top,
        Math.max(minVisible - rect.bottom, dy),
      );
      x.set(startX + clampedDx);
      y.set(startY + clampedDy);
      void nextLeft;
      void nextTop;
    };

    const cleanup = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
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
          holdDelay={5000}
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

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-light">Scan E-Pass</DialogTitle>
            <DialogDescription>
              Point the camera at a rider's E-Pass to open their bike instantly.
            </DialogDescription>
          </DialogHeader>
          <EPassScanner active={scanOpen} onNavigate={() => setScanOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}