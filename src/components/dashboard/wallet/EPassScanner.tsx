import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, RefreshCw, SwitchCamera, ScanLine, ArrowRight, Sparkles, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useQrScanner } from "@/hooks/useQrScanner";
import { parseEPassCode } from "@/lib/epass/parse-epass";

interface Props {
  /** Only mount the camera when the scanner surface is visible. */
  active: boolean;
  onNavigate?: () => void;
}

/** Live camera E-Pass scanner: auto-captures the QR, freezes the frame and opens the bike garage. */
const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default function EPassScanner({ active, onNavigate }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [decoded, setDecoded] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const redirectedRef = useRef(false);

  const handleResult = useCallback((value: string) => {
    setDecoded(parseEPassCode(value));
  }, []);

  const isStaff = user?.role === "staff" || user?.role === "admin";

  /** Resolves the scanned code to a bike id and opens the identification page. */
  const openBike = useCallback(
    async (code: string) => {
      setResolving(true);
      setNotFound(false);
      let bikeId: string | null = isUuid(code) ? code : null;
      if (!bikeId) {
        const { data } = await supabase
          .from("customer_bikes")
          .select("id")
          .ilike("serial", code)
          .limit(1)
          .maybeSingle();
        bikeId = data?.id ?? null;
      }
      if (!bikeId) {
        // Serial owned by another rider: resolve through the secure E-Pass lookup.
        const { data: rows } = await supabase.rpc("get_epass_bike", { _identifier: code });
        bikeId = (Array.isArray(rows) ? rows[0]?.id : null) ?? null;
      }
      setResolving(false);
      if (!bikeId) {
        setNotFound(true);
        return;
      }
      onNavigate?.();
      // Remember where the scan started so the breadcrumb can return the rider
      // to the exact garage view (and selected bike) they came from.
      const returnTo = `${location.pathname}${location.search}`;
      navigate(
        isStaff
          ? `/dashboard/staff/garage/bike/${encodeURIComponent(bikeId)}`
          : `/dashboard/garage/bike/${encodeURIComponent(bikeId)}`,
        { state: { returnTo } },
      );
    },
    [isStaff, navigate, onNavigate, location.pathname, location.search],
  );

  // Auto-redirect as soon as a valid E-Pass is identified.
  useEffect(() => {
    if (!decoded || redirectedRef.current) return;
    redirectedRef.current = true;
    void openBike(decoded);
  }, [decoded, openBike]);

  const {
    videoRef, canvasRef, status, error, snapshot, aiBusy,
    zoom, zoomRange, digitalZoom, setZoom, start, capture, reset, flipCamera,
  } = useQrScanner({ onResult: handleResult, active });

  const goToBike = () => {
    if (!decoded) return;
    redirectedRef.current = true;
    void openBike(decoded);
  };

  const scanning = status === "scanning";

  return (
    <div className="space-y-4">
      {/* Gradient primary border wrapping the whole scan surface */}
      <div className="relative w-full rounded-[28px] bg-gradient-to-br from-primary via-primary/40 to-primary/5 p-[1.5px]">
        <div className="relative aspect-square w-full overflow-hidden rounded-[26px] bg-background">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${snapshot ? "invisible" : ""}`}
            style={digitalZoom ? { transform: `scale(${zoom})`, transformOrigin: "center" } : undefined}
          />
          {snapshot && (
            <img src={snapshot} alt="Captured E-Pass frame" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Full-width radar overlay */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 rounded-[26px] ring-1 ring-inset ring-primary/30" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,hsl(var(--background)/0.55)_100%)]" />

            {/* Corner brackets */}
            {[
              "left-4 top-4 border-l-2 border-t-2 rounded-tl-xl",
              "right-4 top-4 border-r-2 border-t-2 rounded-tr-xl",
              "left-4 bottom-4 border-l-2 border-b-2 rounded-bl-xl",
              "right-4 bottom-4 border-r-2 border-b-2 rounded-br-xl",
            ].map((c) => (
              <div key={c} className={`absolute h-10 w-10 border-primary/80 ${c}`} />
            ))}

            {(scanning || aiBusy) && (
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-[10px] uppercase tracking-widest text-primary backdrop-blur-sm">
                  {aiBusy ? <Sparkles className="h-3 w-3 animate-pulse" /> : <ScanLine className="h-3 w-3" />}
                  {aiBusy ? "AI reading frame" : "Auto-detecting QR"}
                </span>
              </div>
            )}
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
      </div>

      {zoomRange && (scanning || status === "captured") && (
        <div className="flex items-center gap-3 px-1">
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={zoomRange.min}
            max={zoomRange.max}
            step={(zoomRange.max - zoomRange.min) / 20 || 0.1}
            onValueChange={([v]) => setZoom(v)}
          />
          <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
            {zoom.toFixed(1)}×
          </span>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="rounded-full" onClick={flipCamera} title="Switch camera">
          <SwitchCamera className="h-4 w-4" />
        </Button>
        <Button
          className="rounded-full px-6"
          onClick={() => {
            if (snapshot) {
              redirectedRef.current = false;
              setDecoded(null);
              setNotFound(false);
              reset();
            } else {
              capture();
            }
          }}
          disabled={status === "requesting" || aiBusy}
        >
          {snapshot ? <RefreshCw className="mr-2 h-4 w-4" /> : <ScanLine className="mr-2 h-4 w-4" />}
          {snapshot ? "Scan again" : "Capture now"}
        </Button>
      </div>

      {snapshot && !aiBusy && (
        <div className="rounded-2xl border border-border/50 bg-card/40 p-4 text-center space-y-3">
          {decoded ? (
            <>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {resolving ? "Identifying E-Pass" : notFound ? "Unknown E-Pass" : "E-Pass detected"}
              </p>
              <p className="truncate text-sm font-medium text-foreground">{decoded}</p>
              {notFound && (
                <p className="text-xs text-muted-foreground">
                  No bike is registered with this code. Try another pass.
                </p>
              )}
              <Button className="w-full rounded-full" onClick={goToBike} disabled={resolving}>
                {resolving ? "Opening…" : "Open bike details"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No QR code in this frame. Move closer, hold steady and capture again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
