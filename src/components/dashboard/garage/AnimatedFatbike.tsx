import { useState } from "react";
import { motion } from "framer-motion";
import type { HealthMetric } from "@/hooks/garage/useGarageBike";

interface Props {
  metrics: HealthMetric[];
  /** Speed of the road / wheels — purely decorative. */
  riding?: boolean;
}

/** Hotspot anchors on the illustration, mapped to the health model keys. */
const HOTSPOTS: { key: string; x: number; y: number; fallback: string }[] = [
  { key: "battery", x: 196, y: 118, fallback: "Battery" },
  { key: "drivetrain", x: 200, y: 158, fallback: "Drivetrain" },
  { key: "brakes", x: 300, y: 108, fallback: "Brakes" },
  { key: "tyres", x: 100, y: 196, fallback: "Tyres" },
  { key: "frame", x: 152, y: 96, fallback: "Frame & bolts" },
];

const toneOf = (v: number) =>
  v >= 70 ? "text-wj-green" : v >= 40 ? "text-amber-500" : "text-destructive";
const strokeOf = (v: number) =>
  v >= 70 ? "hsl(var(--wj-green, 145 93% 29%))" : v >= 40 ? "#f59e0b" : "hsl(var(--destructive))";

/**
 * Illustrated fatbike that "rides" over a scrolling road.
 * Each essential component is a hover hotspot showing its live health value.
 */
export default function AnimatedFatbike({ metrics, riding = true }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const byKey = new Map(metrics.map((m) => [m.key, m]));

  return (
    <div className="relative w-full h-full min-h-[200px] select-none">
      <svg viewBox="0 0 400 230" className="w-full h-full" role="img" aria-label="Fatbike condition map">
        <defs>
          <linearGradient id="fb-frame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {/* Road */}
        <g>
          <line x1="0" y1="206" x2="400" y2="206" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
          <motion.g
            animate={riding ? { x: [0, -80] } : { x: 0 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <rect
                key={i}
                x={i * 80}
                y={212}
                width="40"
                height="3"
                rx="1.5"
                fill="currentColor"
                fillOpacity="0.25"
              />
            ))}
          </motion.g>
        </g>

        {/* Bike (subtle bobbing while riding) */}
        <motion.g
          animate={riding ? { y: [0, -2.5, 0] } : { y: 0 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          className="text-foreground"
        >
          {/* Fat tyres */}
          {[100, 300].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={160} r="44" fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="12" />
              <circle cx={cx} cy={160} r="32" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <motion.g
                style={{ originX: `${cx}px`, originY: "160px" }}
                animate={riding ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
              >
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = (i * Math.PI) / 4;
                  return (
                    <line
                      key={i}
                      x1={cx}
                      y1={160}
                      x2={cx + Math.cos(a) * 32}
                      y2={160 + Math.sin(a) * 32}
                      stroke="currentColor"
                      strokeOpacity="0.35"
                      strokeWidth="1.5"
                    />
                  );
                })}
                <circle cx={cx} cy={160} r="4" fill="currentColor" fillOpacity="0.6" />
              </motion.g>
            </g>
          ))}

          {/* Frame */}
          <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" strokeOpacity="0.9">
            <path d="M100 160 L200 160" />
            <path d="M200 160 L165 100" />
            <path d="M165 100 L245 100" />
            <path d="M245 100 L300 160" />
            <path d="M200 160 L245 100" />
            <path d="M165 100 L152 78" />
          </g>

          {/* Cockpit + saddle */}
          <path d="M140 76 L166 76" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <path d="M232 92 L262 92" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <path d="M245 100 L262 92" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />

          {/* Battery on the down tube */}
          <rect x="176" y="108" width="46" height="16" rx="8" transform="rotate(-28 176 108)" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />

          {/* Motor / drivetrain */}
          <circle cx="200" cy="160" r="13" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.6" strokeWidth="3" />
          <motion.g
            style={{ originX: "200px", originY: "160px" }}
            animate={riding ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          >
            <line x1="200" y1="160" x2="200" y2="182" stroke="currentColor" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
            <line x1="200" y1="160" x2="200" y2="138" stroke="currentColor" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
          </motion.g>

          {/* Brake caliper hint */}
          <circle cx="300" cy="118" r="5" fill="currentColor" fillOpacity="0.45" />
        </motion.g>

        {/* Hover hotspots */}
        {HOTSPOTS.map((h) => {
          const metric = byKey.get(h.key);
          const value = metric?.value ?? 0;
          return (
            <g
              key={h.key}
              onMouseEnter={() => setActive(h.key)}
              onMouseLeave={() => setActive((k) => (k === h.key ? null : k))}
              onFocus={() => setActive(h.key)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              role="button"
              aria-label={`${metric?.label ?? h.fallback}: ${value}%`}
              className="cursor-pointer outline-none"
            >
              <circle cx={h.x} cy={h.y} r="14" fill="transparent" />
              <circle
                cx={h.x}
                cy={h.y}
                r={active === h.key ? 8 : 5}
                fill={strokeOf(value)}
                fillOpacity={active === h.key ? 0.35 : 0.18}
                stroke={strokeOf(value)}
                strokeWidth="1.5"
                className="transition-all duration-200"
              />
              <circle cx={h.x} cy={h.y} r="2" fill={strokeOf(value)} />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {HOTSPOTS.filter((h) => h.key === active).map((h) => {
        const metric = byKey.get(h.key);
        const value = metric?.value ?? 0;
        return (
          <motion.div
            key={h.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border border-border/40 bg-background/90 backdrop-blur-md px-3 py-2 shadow-lg"
            style={{ left: `${(h.x / 400) * 100}%`, top: `${(h.y / 230) * 100 - 4}%` }}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {metric?.label ?? h.fallback}
            </p>
            <p className={`text-lg font-light tabular-nums ${toneOf(value)}`}>{value}%</p>
            {metric?.detail && (
              <p className="text-[10px] text-muted-foreground/80">{metric.detail}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}