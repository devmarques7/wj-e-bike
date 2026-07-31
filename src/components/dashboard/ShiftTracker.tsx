import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, Play, Pause, StopCircle, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeshGradient } from "@paper-design/shaders-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useShift } from "@/hooks/useShift";
import { FinishShiftDialog } from "@/components/dashboard/FinishShiftDialog";

export default function ShiftTracker() {
  const { theme } = useTheme();
  const {
    status,
    elapsedSec,
    working,
    start,
    pause,
    resume,
    finish,
    row,
  } = useShift();
  const constraintsRef = useRef(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  const x = useMotionValue(0);
  const sliderWidth = 200;
  const thumbWidth = 48;
  const maxDrag = sliderWidth - thumbWidth - 8;
  
  const backgroundColor = useTransform(
    x,
    [0, maxDrag],
    ["rgba(5, 140, 66, 0.1)", "rgba(5, 140, 66, 0.3)"]
  );
  
  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
  const checkOpacity = useTransform(x, [maxDrag * 0.7, maxDrag], [0, 1]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatClock = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  };


  const handleDragEnd = () => {
    const currentX = x.get();
    if (currentX >= maxDrag * 0.8) {
      animate(x, maxDrag, { duration: 0.2 });
      setTimeout(async () => {
        await start();
        animate(x, 0, { duration: 0 });
      }, 300);
    } else {
      animate(x, 0, { duration: 0.3, type: "spring", stiffness: 400, damping: 30 });
    }
  };

  // Map shared status into the visual states this card supports.
  const visual: "idle" | "active" | "paused" | "completed" = status === "completed" ? "completed" : status;
  const isCompleted = visual === "completed";
  const isPaused = visual === "paused";

  // Dynamic mesh gradient palette per theme
  const shaderColors = isCompleted
    ? ["#450a0a", "#dc2626", "#f87171", "#058c42", "#86efac"]
    : isPaused
    ? ["#3a2a02", "#a16207", "#eab308", "#fde047", "#fefce8"]
    : theme === "dark"
    ? ["#0a0a0a", "#0d2818", "#058c42", "#10b981", "#022c1a"]
    : ["#f5f7f5", "#dff5e8", "#058c42", "#86efac", "#ecfdf5"];


  return (
    <div className="h-full relative group">
      {/* Animated Gradient Border */}
      <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
        <motion.div
          className="absolute -inset-[100%] w-[300%] h-[300%]"
          style={{
            background: visual === "active" || visual === "completed"
              ? "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 60deg, hsl(var(--wj-green) / 0.8) 120deg, hsl(var(--wj-green)) 180deg, hsl(var(--wj-green) / 0.8) 240deg, transparent 300deg, transparent 360deg)"
              : visual === "paused"
              ? "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 60deg, hsl(45 100% 50% / 0.8) 120deg, hsl(45 100% 50%) 180deg, hsl(45 100% 50% / 0.8) 240deg, transparent 300deg, transparent 360deg)"
              : "transparent",
          }}
          animate={{ rotate: visual !== "idle" ? 360 : 0 }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative h-full rounded-2xl overflow-hidden bg-background"
      >
        {/* Animated Mesh Gradient Background */}
        <MeshGradient
          colors={shaderColors}
          speed={0.25}
          distortion={1}
          swirl={0.8}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: theme === "dark" ? 0.85 : 0.7 }}
        />

        {/* Overlay for legibility */}
        <div className={cn(
          "absolute inset-0",
          isCompleted
            ? "bg-gradient-to-t from-destructive/85 via-destructive/40 to-wj-green/40"
            : isPaused
            ? "bg-gradient-to-t from-amber-500/85 via-amber-500/40 to-amber-400/20"
            : "bg-gradient-to-t from-background/90 via-background/40 to-background/10 dark:from-background/80 dark:via-background/30 dark:to-transparent"
        )} />
        
        {/* Content */}
        <div className="relative z-10 h-full p-4 flex flex-col justify-between">
          <div>
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center mb-3 border",
              isCompleted || isPaused
                ? "bg-white/20 border-white/30"
                : "bg-wj-green/20 border-wj-green/30"
            )}>
              {isCompleted ? (
                <CheckCircle className="h-4 w-4 text-white" />
              ) : (
                <Clock className="h-4 w-4 text-wj-green" />
              )}
            </div>
            <h3 className={cn("text-sm font-semibold mb-1", isCompleted || isPaused ? "text-white" : "text-foreground")}>
              {isCompleted
                ? "Shift Completed"
                : visual === "idle"
                ? "Start Shift"
                : visual === "active"
                ? "Shift Active"
                : "Shift Paused"}
            </h3>
            <p className={cn("text-[10px] leading-relaxed", isCompleted || isPaused ? "text-white/80" : "text-muted-foreground")}>
              {isCompleted
                ? "You've clocked out for today"
                : visual === "idle"
                ? "Swipe to clock in"
                : visual === "active"
                ? "Tracking your work hours"
                : "Timer paused"}
            </p>
          </div>

          {visual === "idle" && !isCompleted ? (
            /* Swipe Slider */
            <motion.div
              ref={constraintsRef}
              style={{ backgroundColor }}
              className="relative h-12 rounded-full border border-wj-green/30 overflow-hidden"
            >
              <motion.div 
                style={{ opacity: textOpacity }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <span className="text-[10px] text-wj-green/70 font-medium tracking-wide">
                  Slide to start →
                </span>
              </motion.div>
              
              <motion.div 
                style={{ opacity: checkOpacity }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <CheckCircle className="h-4 w-4 text-wj-green" />
              </motion.div>

              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: maxDrag }}
                dragElastic={0}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className="absolute left-1 top-1 bottom-1 w-10 rounded-full bg-wj-green flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg shadow-wj-green/30"
              >
                <ArrowRight className="h-4 w-4 text-background" />
              </motion.div>
            </motion.div>
          ) : (
            /* Timer Display */
            <div className="space-y-3">
              {/* Timer */}
              <div className="text-center py-2">
                <p className={cn(
                  "text-2xl font-mono font-bold",
                  isCompleted || isPaused
                    ? "text-white"
                    : "text-wj-green"
                )}>
                  {formatTime(elapsedSec)}
                </p>
                {isCompleted && (
                  <p className="text-[10px] text-white/70 mt-1">Total worked today</p>
                )}
              </div>

              {/* Completed summary */}
              {isCompleted && row && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/10 border border-white/20 p-2">
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wider text-white/60 mb-0.5">Clock in</p>
                    <p className="text-xs font-semibold text-white tabular-nums">{formatClock(row.clock_in)}</p>
                  </div>
                  <div className="text-center border-l border-white/20">
                    <p className="text-[9px] uppercase tracking-wider text-white/60 mb-0.5">Clock out</p>
                    <p className="text-xs font-semibold text-white tabular-nums">{formatClock(row.clock_out)}</p>
                  </div>
                  <div className="text-center border-l border-white/20">
                    <p className="text-[9px] uppercase tracking-wider text-white/60 mb-0.5">Total</p>
                    <p className="text-xs font-semibold text-white tabular-nums">{formatDuration(row.worked_minutes)}</p>
                  </div>
                </div>
              )}

              {/* Controls */}
              {!isCompleted && (
                <div className="flex gap-2">
                  {visual === "active" ? (
                    <Button
                      onClick={() => pause()}
                      disabled={working}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs bg-transparent border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300"
                    >
                      <Pause className="h-3.5 w-3.5 mr-1.5" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      onClick={() => resume()}
                      disabled={working}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs bg-white/10 border-white/50 text-white hover:bg-white/20 hover:text-white"
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Resume
                    </Button>
                  )}
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={working}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 h-9 text-xs",
                      isPaused
                        ? "bg-white/10 border-white/50 text-white hover:bg-white/20 hover:text-white"
                        : "bg-transparent border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
                    )}
                  >
                    <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                    End
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
      <FinishShiftDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={finish}
        working={working}
      />
    </div>
  );
}
