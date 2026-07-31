import { MeshGradient } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

export type CardTier = "basic" | "mid" | "ultra";

/**
 * Plan-tier palettes for the E-Pass mesh background.
 * Basic  -> lighter tones mixed with WJ green.
 * Mid    -> deep dark tones mixed with WJ green.
 * Ultra  -> dark base mixed with white and neon green highlights.
 */
const TIER_MESH: Record<CardTier, { colors: string[]; opacity: number; scrim: string }> = {
  basic: {
    colors: ["#eef7f1", "#c9edd8", "#058c42", "#a7f3d0", "#f6fbf7"],
    opacity: 0.9,
    scrim: "linear-gradient(90deg, rgba(3,20,11,0.72) 0%, rgba(3,20,11,0.28) 55%, rgba(3,20,11,0.55) 100%)",
  },
  mid: {
    colors: ["#04120b", "#0b2417", "#058c42", "#065f46", "#010a06"],
    opacity: 0.95,
    scrim: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.45) 100%)",
  },
  ultra: {
    colors: ["#050705", "#0d1210", "#ffffff", "#39ff14", "#04331d"],
    opacity: 1,
    scrim: "linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.5) 100%)",
  },
};

/** Maps a plan name/slug to one of the three visual tiers. */
export function tierFromPlan(plan?: string | null): CardTier {
  const p = (plan || "").toLowerCase();
  if (/(black|ultra|vip|elite|pro\b)/.test(p)) return "ultra";
  if (/(plus|premium|mid|gold|silver)/.test(p)) return "mid";
  return "basic";
}

export interface CardMeshBackgroundProps {
  tier?: CardTier;
  className?: string;
}

/**
 * Animated mesh-gradient background for the wallet cards — the same shader
 * treatment used by the Urgent Service card, tinted per membership tier.
 */
export function CardMeshBackground({ tier = "basic", className }: CardMeshBackgroundProps) {
  const cfg = TIER_MESH[tier];
  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <MeshGradient
        colors={cfg.colors}
        speed={0.22}
        distortion={1}
        swirl={0.8}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: cfg.opacity }}
      />
      <div className="absolute inset-0" style={{ background: cfg.scrim }} />
    </div>
  );
}
