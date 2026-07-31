import { MeshGradient } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";
import { getWalletTheme } from "@/lib/wallet/cardThemes";

export type CardTier = "basic" | "mid" | "ultra";

const WJ_GREEN = "#058c42";
const NEON_GREEN = "#39ff14";

/** Maps a plan name/slug to one of the three visual tiers. */
export function tierFromPlan(plan?: string | null): CardTier {
  const p = (plan || "").toLowerCase();
  if (/(black|ultra|vip|elite)/.test(p)) return "ultra";
  if (/(plus|premium|mid|gold|silver)/.test(p)) return "mid";
  return "basic";
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Linear blend between two hex colours. `t` = 0 keeps `a`, 1 keeps `b`. */
function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

const lighten = (c: string, t: number) => mix(c, "#ffffff", t);
const darken = (c: string, t: number) => mix(c, "#000000", t);

/**
 * Builds the 5-stop mesh palette from the card's dual hues, following the
 * membership-tier recipe:
 *  - basic: lighter tones mixed with WJ green
 *  - mid:   darker tones mixed with WJ green
 *  - ultra: dark base with white and neon-green highlights
 */
export function meshPaletteFor(tier: CardTier, hues: [string, string]) {
  const [accent, deep] = hues;
  if (tier === "basic") {
    return {
      colors: [
        lighten(accent, 0.82),
        lighten(mix(accent, WJ_GREEN, 0.5), 0.55),
        mix(WJ_GREEN, "#ffffff", 0.25),
        lighten(deep, 0.7),
        lighten(WJ_GREEN, 0.75),
      ],
      opacity: 0.9,
      scrim: "linear-gradient(90deg, rgba(3,20,11,0.7) 0%, rgba(3,20,11,0.25) 55%, rgba(3,20,11,0.55) 100%)",
    };
  }
  if (tier === "mid") {
    return {
      colors: [
        darken(deep, 0.55),
        mix(darken(accent, 0.55), WJ_GREEN, 0.35),
        WJ_GREEN,
        darken(mix(accent, WJ_GREEN, 0.6), 0.35),
        darken(deep, 0.75),
      ],
      opacity: 0.95,
      scrim: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.45) 100%)",
    };
  }
  return {
    colors: [
      darken(deep, 0.8),
      darken(accent, 0.7),
      "#ffffff",
      NEON_GREEN,
      mix(darken(accent, 0.5), NEON_GREEN, 0.3),
    ],
    opacity: 1,
    scrim: "linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.5) 100%)",
  };
}

export interface CardMeshBackgroundProps {
  tier?: CardTier;
  /** Selected wallet theme — provides the dual hues for the mesh. */
  themeId?: string | null;
  className?: string;
}

/**
 * Animated mesh-gradient background for the wallet cards — the same shader
 * treatment used by the Urgent Service card, tinted by the selected card
 * colour and re-graded by membership tier.
 */
export function CardMeshBackground({ tier = "basic", themeId, className }: CardMeshBackgroundProps) {
  const cfg = meshPaletteFor(tier, getWalletTheme(themeId).hues);
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
