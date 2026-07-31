import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "@/integrations/supabase/client";

export type ScannerStatus = "idle" | "requesting" | "scanning" | "denied" | "error" | "captured";

interface Options {
  /** Called once with the decoded QR payload (after the freeze-frame). */
  onResult: (value: string, snapshot: string) => void;
  active: boolean;
  /** Use the AI gateway as a fallback when the local decoder can't read a small code. */
  aiAssist?: boolean;
}

/** Center region-of-interest crops (as a fraction of the frame) tried each pass. */
const ROI_SCALES = [1, 0.6, 0.38, 0.24];
/** Upscale factor applied to small crops so tiny QR modules become decodable. */
const UPSCALE = 2;

/**
 * Camera + QR decoding for the E-Pass scanner.
 * Scans the full frame and progressively tighter (digitally zoomed) center crops so
 * small codes are still found, auto-freezes the snapshot on a hit, and can escalate
 * a frozen frame to the AI gateway when the local decoder fails.
 */
export function useQrScanner({ onResult, active, aiAssist = true }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const startedAtRef = useRef(0);
  const aiTriedRef = useRef(false);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  /** True when the device has no native zoom and we crop the frame instead. */
  const [digitalZoom, setDigitalZoom] = useState(true);
  const zoomRef = useRef(1);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const getWorkCanvas = () => {
    if (!workRef.current) workRef.current = document.createElement("canvas");
    return workRef.current;
  };

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const grabSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return "";
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  const handleHit = useCallback(
    (value: string, shotOverride?: string) => {
      if (lockRef.current) return;
      lockRef.current = true;
      const shot = shotOverride || grabSnapshot();
      setSnapshot(shot);
      setStatus("captured");
      stop();
      onResult(value, shot);
    },
    [grabSnapshot, onResult, stop]
  );

  /** Try to decode the video frame at several center crops / zoom levels. */
  const decodeFrame = useCallback((video: HTMLVideoElement): string | null => {
    const canvas = getWorkCanvas();
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !video.videoWidth) return null;

    // When zooming digitally, the visible frame is already cropped to 1/zoom.
    const base = digitalZoom ? 1 / Math.max(1, zoomRef.current) : 1;
    for (const roi of ROI_SCALES) {
      const scale = Math.min(1, base * roi);
      const sw = Math.round(video.videoWidth * scale);
      const sh = Math.round(video.videoHeight * scale);
      const sx = Math.round((video.videoWidth - sw) / 2);
      const sy = Math.round((video.videoHeight - sh) / 2);
      const factor = scale < 1 ? UPSCALE : 1;
      canvas.width = sw * factor;
      canvas.height = sh * factor;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data;
    }
    return null;
  }, [digitalZoom]);

  /** Escalate a frozen frame to the AI gateway (small / low-contrast codes). */
  const decodeWithAi = useCallback(
    async (shot: string) => {
      if (!shot || lockRef.current) return false;
      setAiBusy(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("decode-qr", { body: { image: shot } });
        if (fnError) throw fnError;
        const value = (data as any)?.value as string | null;
        if (value) {
          handleHit(value, shot);
          return true;
        }
      } catch {
        /* silent: local decoding remains the primary path */
      } finally {
        setAiBusy(false);
      }
      return false;
    },
    [handleHit]
  );

  const applyZoom = useCallback((value: number) => {
    const track = streamRef.current?.getVideoTracks()[0] as any;
    const caps = track?.getCapabilities?.();
    if (!caps?.zoom) {
      // Digital fallback: clamp locally, the video is scaled via CSS.
      const clampedDigital = Math.min(5, Math.max(1, value));
      zoomRef.current = clampedDigital;
      setZoomState(clampedDigital);
      return;
    }
    const clamped = Math.min(caps.zoom.max, Math.max(caps.zoom.min, value));
    track.applyConstraints({ advanced: [{ zoom: clamped }] }).catch(() => {});
    zoomRef.current = clamped;
    setZoomState(clamped);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setSnapshot(null);
    lockRef.current = false;
    aiTriedRef.current = false;
    startedAtRef.current = Date.now();
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setStatus("scanning");

      const track = stream.getVideoTracks()[0] as any;
      const caps = track?.getCapabilities?.();
      if (caps?.zoom) {
        setDigitalZoom(false);
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
        const initial = track.getSettings?.().zoom ?? caps.zoom.min;
        zoomRef.current = initial;
        setZoomState(initial);
      } else {
        // No hardware zoom (most desktops / iOS Safari): expose digital zoom.
        setDigitalZoom(true);
        setZoomRange({ min: 1, max: 5 });
        zoomRef.current = 1;
        setZoomState(1);
      }
      if (caps?.focusMode?.includes?.("continuous")) {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
      }

      const Detector = (window as any).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

      const tick = async () => {
        if (!videoRef.current || lockRef.current) return;
        const v = videoRef.current;
        if (v.readyState === v.HAVE_ENOUGH_DATA) {
          try {
            if (detector) {
              const codes = await detector.detect(v);
              if (codes?.[0]?.rawValue) return handleHit(codes[0].rawValue);
            }
            const local = decodeFrame(v);
            if (local) return handleHit(local);

            // AI assist: after a few seconds without a local read, freeze one frame and ask the model.
            if (aiAssist && !aiTriedRef.current && Date.now() - startedAtRef.current > 5000) {
              aiTriedRef.current = true;
              const shot = grabSnapshot();
              decodeWithAi(shot);
            }
          } catch {
            /* frame skipped */
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
        setStatus("denied");
        setError("Camera permission denied. Allow access in your browser settings to scan.");
      } else {
        setStatus("error");
        setError(e?.message ?? "No camera available on this device.");
      }
    }
  }, [aiAssist, decodeFrame, decodeWithAi, facingMode, grabSnapshot, handleHit]);

  /** Manual screenshot: freeze the frame, decode locally, then escalate to AI. */
  const capture = useCallback(async () => {
    const video = videoRef.current;
    const shot = grabSnapshot();
    setSnapshot(shot);
    if (video) {
      const local = decodeFrame(video);
      if (local) return handleHit(local, shot);
    }
    setStatus("captured");
    stop();
    if (aiAssist) await decodeWithAi(shot);
  }, [aiAssist, decodeFrame, decodeWithAi, grabSnapshot, handleHit, stop]);

  const reset = useCallback(() => {
    lockRef.current = false;
    aiTriedRef.current = false;
    setSnapshot(null);
    start();
  }, [start]);

  const flipCamera = useCallback(() => {
    stop();
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  }, [stop]);

  useEffect(() => {
    if (active) start();
    else {
      stop();
      setStatus("idle");
      setSnapshot(null);
      lockRef.current = false;
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, facingMode]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    snapshot,
    facingMode,
    aiBusy,
    zoom,
    zoomRange,
    digitalZoom,
    setZoom: applyZoom,
    start,
    capture,
    reset,
    flipCamera,
  };
}
