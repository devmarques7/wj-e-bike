import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Crosshair, RefreshCw, SwitchCamera, ScanLine, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQrScanner } from "@/hooks/useQrScanner";
import { parseEPassCode } from "@/lib/epass/parse-epass";

interface Props {
  /** Only mount the camera when the scanner surface is visible. */
  active: boolean;
  onNavigate?: () => void;
}

/** Live camera E-Pass scanner: centers the QR, freezes a snapshot and opens the bike garage. */
export default function EPassScanner({ active, onNavigate }: Props) {
  const navigate = useNavigate();
  const [decoded, setDecoded] = useState<string | null>(null);

  const handleResult = useCallback((value: string) => {
    setDecoded(parseEPassCode(value));
  }, []);

  const { videoRef, canvasRef, status, error, snapshot, start, capture, reset, flipCamera } =
    useQrScanner({ onResult: handleResult, active });

  const goToBike = () => {
    if (!decoded) return;
    onNavigate?.();
    navigate(`/dashboard/garage?bike=${encodeURIComponent(decoded)}`);
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border/50 bg-foreground/[0.04]">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`h-full w-full object-cover ${snapshot ? "invisible" : ""}`}
        />
        {snapshot && (
          <img src={snapshot} alt="Captured E-Pass frame" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Center framing guide */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[62%] w-[62%] rounded-3xl border border-primary/60">
            <Crosshair className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary/70" />
            {status === "scanning" && (
              <motion.div
                className="absolute inset-x-2 h-[2px] rounded-full bg-primary"
                initial={{ top: "6%" }}
                animate={{ top: ["6%", "94%", "6%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
        </div>

        {(status === "idle" || status === "requesting" || status === "denied" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 px-6 text-center backdrop-blur-sm">
            <Camera className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {status === "requesting"
                ? "Requesting camera access…"
                : error ?? "Allow camera access to scan an E-Pass."}
            </p>
            {status !== "requesting" && (
              <Button size="sm" variant="outline" className="rounded-full" onClick={start}>
                Enable camera
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="rounded-full" onClick={flipCamera} title="Switch camera">
          <SwitchCamera className="h-4 w-4" />
        </Button>
        <Button
          className="rounded-full px-6"
          onClick={snapshot ? reset : capture}
          disabled={status === "requesting"}
        >
          {snapshot ? <RefreshCw className="mr-2 h-4 w-4" /> : <ScanLine className="mr-2 h-4 w-4" />}
          {snapshot ? "Scan again" : "Capture"}
        </Button>
      </div>

      {snapshot && (
        <div className="rounded-2xl border border-border/50 bg-card/40 p-4 text-center space-y-3">
          {decoded ? (
            <>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">E-Pass detected</p>
              <p className="truncate text-sm font-medium text-foreground">{decoded}</p>
              <Button className="w-full rounded-full" onClick={goToBike}>
                Open bike details <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No QR code in this frame. Center the pass and capture again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}