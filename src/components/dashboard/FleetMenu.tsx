import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { QrCode, CalendarPlus, Pause, Play } from "lucide-react";
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

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.08}
        whileDrag={{ scale: 1.03 }}
        className="fixed bottom-4 right-2 z-50 cursor-grab active:cursor-grabbing"
      >
        <GooeyActions
          label="Fleet"
          actions={actions}
          radius={104}
          arc={[-190, -10]}
          coreY={0.68}
          style={{ width: 260, height: 220 }}
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