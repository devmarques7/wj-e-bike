import QRCodeStyling, {
  type Options as QRCodeStylingOptions,
  type DotType,
  type CornerSquareType,
  type CornerDotType,
} from "qr-code-styling";

/**
 * E-Pass styled QR generator.
 *
 * Phase 1 — client-side only. Resolves colours from the current theme tokens
 * (CSS variables defined in `src/index.css`) so the QR always looks like a
 * native part of the system. No DB / no preset storage yet.
 */

export interface StyledQROverrides {
  width?: number;
  height?: number;
  margin?: number;
  /** Solid colour for the small dots. Defaults to theme `--foreground`. */
  dotsColor?: string;
  /** Colour of the 3 big corner squares. Defaults to theme `--primary`. */
  cornersColor?: string;
  /** Background colour. Defaults to theme `--background`. */
  backgroundColor?: string;
  /** 0.15 – 0.35. Anything above 0.35 is clamped (legibility). */
  imageSize?: number;
  hideBackgroundDots?: boolean;
  dotsType?: DotType;
  cornersSquareType?: CornerSquareType;
  cornersDotType?: CornerDotType;
}

export interface BuildStyledQROptions {
  data: string;
  logoUrl?: string;
  overrides?: StyledQROverrides;
}

// ────────────────────────────────────────────────────────────────────────────
// Theme token resolution (HSL CSS vars → hex)
// ────────────────────────────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function readThemeColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) return fallback;
  // Expect "H S% L%" — split tolerantly.
  const parts = raw.replace(/%/g, "").split(/[ ,]+/).filter(Boolean);
  if (parts.length < 3) return fallback;
  const [h, s, l] = parts.map(Number);
  if ([h, s, l].some((n) => Number.isNaN(n))) return fallback;
  return hslToHex(h, s, l);
}

export function resolveThemeQRColors() {
  // QR codes are always rendered on dark surfaces (E-Pass cards, back faces),
  // so the dots and corners must always stay light regardless of the theme.
  return {
    dots: readThemeColor("--primary-foreground", "#f8f8f8"),
    corners: readThemeColor("--primary-foreground", "#f8f8f8"),
    background: readThemeColor("--background", "#0a0a0a"),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Builder
// ────────────────────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE = 0.35;

export function buildStyledQROptions({
  data,
  logoUrl,
  overrides = {},
}: BuildStyledQROptions): QRCodeStylingOptions {
  const theme = resolveThemeQRColors();
  const imageSize = Math.min(overrides.imageSize ?? 0.3, MAX_IMAGE_SIZE);

  return {
    width: overrides.width ?? 400,
    height: overrides.height ?? 400,
    type: "svg",
    data,
    margin: overrides.margin ?? 10,
    image: logoUrl,
    qrOptions: {
      // Always "H" — non-configurable. Guarantees reads even with a centre logo.
      errorCorrectionLevel: "H",
    },
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 8,
      imageSize,
      hideBackgroundDots:
        overrides.hideBackgroundDots ?? true,
    },
    dotsOptions: {
      color: overrides.dotsColor ?? theme.dots,
      type: overrides.dotsType ?? "rounded",
    },
    cornersSquareOptions: {
      color: overrides.cornersColor ?? theme.corners,
      type: overrides.cornersSquareType ?? "extra-rounded",
    },
    cornersDotOptions: {
      color: overrides.cornersColor ?? theme.corners,
      type: overrides.cornersDotType ?? "dot",
    },
    backgroundOptions: {
      color: overrides.backgroundColor ?? theme.background,
    },
  };
}

/** Create a `QRCodeStyling` instance ready to be `.append(node)`-ed. */
export function createStyledQR(opts: BuildStyledQROptions): QRCodeStyling {
  return new QRCodeStyling(buildStyledQROptions(opts));
}

/**
 * Generate both an SVG string (best for print) and a PNG data URL (best for
 * inline previews). Runs in the browser.
 */
export async function generateStyledQR(opts: BuildStyledQROptions): Promise<{
  svgString: string;
  pngDataUrl: string;
}> {
  const qr = createStyledQR(opts);
  const [svgBlob, pngBlob] = await Promise.all([
    qr.getRawData("svg") as Promise<Blob>,
    qr.getRawData("png") as Promise<Blob>,
  ]);
  const svgString = await svgBlob.text();
  const pngDataUrl = await blobToDataUrl(pngBlob);
  return { svgString, pngDataUrl };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
