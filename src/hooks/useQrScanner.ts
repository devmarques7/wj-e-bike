import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export type ScannerStatus = "idle" | "requesting" | "scanning" | "denied" | "error" | "captured";

interface Options {
  /** Called once with the decoded QR payload (after the freeze-frame). */
  onResult: (value: string, snapshot: string) => void;
  active: boolean;
}

/**
 * Camera + QR decoding for the E-Pass scanner.
 * Works on desktop (webcam) and mobile (rear camera), asks for permission
 * explicitly and freezes a snapshot when a code is recognised.
 */
export function useQrScanner({ onResult, active }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockRef = useRef(false);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const grabSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return "";
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const handleHit = useCallback(
    (value: string) => {
      if (lockRef.current) return;
      lockRef.current = true;
      const shot = grabSnapshot();
      setSnapshot(shot);
      setStatus("captured");
      stop();
      onResult(value, shot);
    },
    [grabSnapshot, onResult, stop]
  );

  const start = useCallback(async () => {
    setError(null);
    setSnapshot(null);
    lockRef.current = false;
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setStatus("scanning");

      const Detector = (window as any).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (!videoRef.current || lockRef.current) return;
        const v = videoRef.current;
        if (v.readyState === v.HAVE_ENOUGH_DATA) {
          try {
            if (detector) {
              const codes = await detector.detect(v);
              if (codes?.[0]?.rawValue) return handleHit(codes[0].rawValue);
            } else if (ctx) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
              if (code?.data) return handleHit(code.data);
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
  }, [facingMode, handleHit]);

  /** Manual screenshot: freeze the frame and try to decode it once. */
  const capture = useCallback(() => {
    const shot = grabSnapshot();
    setSnapshot(shot);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (canvas && ctx) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code?.data && !lockRef.current) {
        lockRef.current = true;
        setStatus("captured");
        stop();
        onResult(code.data, shot);
        return;
      }
    }
    setStatus("captured");
    stop();
  }, [grabSnapshot, onResult, stop]);

  const reset = useCallback(() => {
    lockRef.current = false;
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

  return { videoRef, canvasRef, status, error, snapshot, facingMode, start, capture, reset, flipCamera };
}