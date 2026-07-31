/**
 * Colour registry for the E-Pass wallet cards.
 * Every card shares the exact same layout — only the palette changes.
 */
export interface WalletCardTheme {
  id: string;
  label: string;
  /** Main background (CSS colour or gradient). */
  background: string;
  /** Dark side-panel that holds the chip. */
  panel: string;
  /** Text colour on the main background. */
  ink: string;
  /** Muted text colour on the main background. */
  inkMuted: string;
  /** Text colour on the dark panel. */
  panelInk: string;
  /** Swatch shown in the picker. */
  swatch: string;
}

/**
 * All palettes are dark and built around the WJ system accent (#058c42),
 * using gradients for depth. Ink is always light for consistent contrast.
 */
export const WALLET_CARD_THEMES: WalletCardTheme[] = [
  {
    id: "wj-green",
    label: "WJ Green",
    background: "linear-gradient(135deg, #0a1a10 0%, #05421f 55%, #058c42 100%)",
    panel: "#050c08",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.6)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "linear-gradient(135deg, #0a1a10 0%, #058c42 100%)",
  },
  {
    id: "volt",
    label: "Volt",
    background: "linear-gradient(135deg, #0b0f0a 0%, #12240f 50%, #2f5c1a 100%)",
    panel: "#060806",
    ink: "#eaffd6",
    inkMuted: "rgba(234,255,214,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "linear-gradient(135deg, #0b0f0a 0%, #2f5c1a 100%)",
  },
  {
    id: "graphite",
    label: "Graphite",
    background: "linear-gradient(135deg, #1c1f1d 0%, #0d0f0e 60%, #06100a 100%)",
    panel: "#000000",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.5)",
    panelInk: "rgba(255,255,255,0.8)",
    swatch: "linear-gradient(135deg, #1c1f1d 0%, #06100a 100%)",
  },
  {
    id: "sand",
    label: "Bronze",
    background: "linear-gradient(135deg, #1d1810 0%, #2e2416 55%, #4a3a1d 100%)",
    panel: "#0c0a06",
    ink: "#f3e6cd",
    inkMuted: "rgba(243,230,205,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "linear-gradient(135deg, #1d1810 0%, #4a3a1d 100%)",
  },
  {
    id: "cobalt",
    label: "Cobalt",
    background: "linear-gradient(135deg, #060d1c 0%, #0b1c3d 55%, #113a6b 100%)",
    panel: "#03070f",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "linear-gradient(135deg, #060d1c 0%, #113a6b 100%)",
  },
  {
    id: "ember",
    label: "Ember",
    background: "linear-gradient(135deg, #170b06 0%, #2e1109 55%, #6b2a12 100%)",
    panel: "#0a0403",
    ink: "#ffe8db",
    inkMuted: "rgba(255,232,219,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "linear-gradient(135deg, #170b06 0%, #6b2a12 100%)",
  },
  {
    id: "orchid",
    label: "Orchid",
    background: "linear-gradient(135deg, #0f0818 0%, #1d0f33 55%, #3b1f6b 100%)",
    panel: "#070310",
    ink: "#f3ecff",
    inkMuted: "rgba(243,236,255,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "linear-gradient(135deg, #0f0818 0%, #3b1f6b 100%)",
  },
  {
    id: "ice",
    label: "Teal",
    background: "linear-gradient(135deg, #04120f 0%, #08251f 55%, #0f4a3c 100%)",
    panel: "#020a08",
    ink: "#e4fff5",
    inkMuted: "rgba(228,255,245,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "linear-gradient(135deg, #04120f 0%, #0f4a3c 100%)",
  },
];

export const DEFAULT_WALLET_THEME_ID = "wj-green";

export function getWalletTheme(id?: string | null): WalletCardTheme {
  return (
    WALLET_CARD_THEMES.find((t) => t.id === id) ??
    WALLET_CARD_THEMES.find((t) => t.id === DEFAULT_WALLET_THEME_ID)!
  );
}

/** Deterministic fallback palette so each card starts with a distinct colour. */
export function themeForIndex(index: number): string {
  return WALLET_CARD_THEMES[index % WALLET_CARD_THEMES.length].id;
}

const STORAGE_KEY = "wj.wallet.card-themes";

export function loadWalletThemes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveWalletThemes(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — themes stay in-memory */
  }
}