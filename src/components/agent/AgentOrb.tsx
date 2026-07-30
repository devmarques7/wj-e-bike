import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type AgentOrbState = "idle" | "thinking" | "speaking";

interface AgentOrbProps {
  /** Visual state of the agent. */
  state?: AgentOrbState;
  /** Rendered size in CSS pixels (square). */
  size?: number;
  className?: string;
}

const POINT_COUNT = 420;

/** Fibonacci sphere — evenly distributed points on a unit sphere. */
function buildSphere(count: number) {
  const pts: { x: number; y: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

/** Reads an HSL design token (e.g. `--wj-green`) as `r,g,b`. */
function tokenToRgb(token: string, fallback: [number, number, number]) {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const m = raw.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return fallback;
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ] as [number, number, number];
}

/**
 * Global agent orb: a rotating 3D point-cloud sphere.
 * - `idle`      → soft radial pulse rippling outward.
 * - `thinking`  → bright scan band sweeping top → bottom.
 * - `speaking`  → faster rotation with a gentle shimmer.
 */
export default function AgentOrb({ state = "idle", size = 96, className }: AgentOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AgentOrbState>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points = buildSphere(POINT_COUNT);
    const accent = tokenToRgb("--wj-green", [5, 140, 66]);
    let raf = 0;
    let disposed = false;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (now: number) => {
      raf = 0;
      if (disposed) return;
      const t = (now - start) / 1000;
      const mode = stateRef.current;
      const spin = mode === "speaking" ? 0.9 : mode === "thinking" ? 0.55 : 0.28;
      const ry = t * spin;
      const rx = Math.sin(t * 0.25) * 0.35;

      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.38;

      // Scan band position for "thinking": travels top → bottom, in sphere Y space (1 → -1).
      const scanCycle = (t * 0.75) % 1;
      const scanY = 1 - scanCycle * 2;
      // Idle breath: a slow, human-like inhale/exhale that expands from the core outward
      // and returns, forever. 4s full cycle, ease-in-out via cosine.
      const breathCycle = 4;
      const breathPhase = (t / breathCycle) % 1;
      const breath = 0.5 - 0.5 * Math.cos(breathPhase * Math.PI * 2); // 0 → 1 → 0


      const projected = points.map((p) => {
        // Ocean ripple: continuous wave displacement across the sphere surface.
        const ripple1 = Math.sin(p.x * 3 + t * 1.6) * Math.cos(p.y * 2.5 + t * 1.1) * 0.05;
        const ripple2 = Math.cos(p.z * 2.2 + t * 0.9) * Math.sin(p.y * 3.2 + t * 1.4) * 0.04;
        const ripple = ripple1 + ripple2;

        const px = p.x * (1 + ripple);
        const py = p.y * (1 + ripple);
        const pz = p.z * (1 + ripple);

        const cosY = Math.cos(ry);
        const sinY = Math.sin(ry);
        let x = px * cosY - pz * sinY;
        let z = px * sinY + pz * cosY;
        const cosX = Math.cos(rx);
        const sinX = Math.sin(rx);
        const y = py * cosX - z * sinX;
        z = py * sinX + z * cosX;
        return { x, y, z, oy: p.y };
      });

      projected.sort((a, b) => a.z - b.z);

      for (const p of projected) {
        const depth = (p.z + 1) / 2; // 0 back → 1 front
        const persp = 0.72 + depth * 0.42;
        const sx = cx + p.x * radius * persp;
        const sy = cy - p.y * radius * persp;

        let intensity = 0.12 + depth * 0.35;
        let dot = 0.7 + depth * 0.9;

        if (mode === "thinking") {
          const d = Math.abs(p.oy - scanY);
          const band = Math.max(0, 1 - d / 0.22);
          intensity += band * band * 0.95;
          dot += band * band * 1.8;
        } else if (mode === "speaking") {
          const shimmer = 0.5 + 0.5 * Math.sin(t * 6 + p.oy * 6);
          intensity += shimmer * 0.35;
          dot += shimmer * 0.7;
        } else {
          const dist = Math.sqrt(p.x * p.x + p.y * p.y);
          // Breath wave: a single, smooth pulse that emanates from the center,
          // travels to the outer edge, and then recedes back to the center.
          const breathWave = Math.max(0, 1 - Math.abs(dist - breath) / 0.28);
          intensity += breathWave * breathWave * 0.5;
          dot += breathWave * breathWave * 0.9;
        }


        ctx.beginPath();
        ctx.fillStyle = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${Math.min(intensity, 1)})`;
        ctx.arc(sx, sy, Math.max(0.4, dot), 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [size]);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-wj-green/20 blur-2xl transition-opacity duration-500",
          state === "thinking" ? "opacity-90" : state === "speaking" ? "opacity-70" : "opacity-40",
        )}
      />
      <canvas ref={canvasRef} style={{ width: size, height: size }} className="relative" />
    </div>
  );
}
