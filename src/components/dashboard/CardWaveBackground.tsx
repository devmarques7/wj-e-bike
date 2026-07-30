import { cn } from "@/lib/utils";

export interface CardWaveBackgroundProps {
  color?: string;
  className?: string;
  /** Opacity of the wave lines (0–1). */
  opacity?: number;
}

/**
 * Horizontal op-art wave pattern used as a subtle background texture on all
 * wallet member cards. The monochrome sinusoid lines flow from left to right,
 * adapting to the active card theme via the `color` prop.
 */
export function CardWaveBackground({
  color = "currentColor",
  className,
  opacity = 0.12,
}: CardWaveBackgroundProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("absolute inset-0 w-full h-full pointer-events-none", className)}
      preserveAspectRatio="none"
      viewBox="0 0 400 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wave-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.15" stopColor={color} stopOpacity={opacity} />
          <stop offset="0.85" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 14 }).map((_, i) => {
        const y = 14 + i * 13;
        const phase = i * 0.55;
        const amplitude = 10 + (i % 3) * 4;
        // Build a smooth horizontal sine-like path across the width.
        const path = `M 0 ${y} C 80 ${y - amplitude}, 120 ${y + amplitude}, 200 ${y} S 320 ${y - amplitude}, 400 ${y}`;
        return (
          <path
            key={i}
            d={path}
            fill="none"
            stroke="url(#wave-fade)"
            strokeLinecap="round"
            strokeWidth={1.4}
            style={{ opacity: 0.7 + (i % 3) * 0.1 }}
          />
        );
      })}
    </svg>
  );
}
