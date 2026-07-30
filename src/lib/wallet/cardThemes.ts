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

export const WALLET_CARD_THEMES: WalletCardTheme[] = [
  {
    id: "volt",
    label: "Volt",
    background: "linear-gradient(135deg, #e8ff3a 0%, #d7f52a 100%)",
    panel: "#1b1b1b",
    ink: "#111111",
    inkMuted: "rgba(17,17,17,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "#e8ff3a",
  },
  {
    id: "wj-green",
    label: "WJ Green",
    background: "#058c42",
    panel: "#0a0a0a",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.65)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "#058c42",
  },
  {
    id: "graphite",
    label: "Graphite",
    background: "linear-gradient(135deg, #2b2b2b 0%, #101010 100%)",
    panel: "#000000",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.55)",
    panelInk: "rgba(255,255,255,0.8)",
    swatch: "#2b2b2b",
  },
  {
    id: "sand",
    label: "Sand",
    background: "linear-gradient(135deg, #f0ebe3 0%, #d9cdb8 100%)",
    panel: "#26211a",
    ink: "#1c1a17",
    inkMuted: "rgba(28,26,23,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "#e2d6c1",
  },
  {
    id: "cobalt",
    label: "Cobalt",
    background: "linear-gradient(135deg, #1f4fd8 0%, #0d2a86 100%)",
    panel: "#07153f",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.6)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "#1f4fd8",
  },
  {
    id: "ember",
    label: "Ember",
    background: "linear-gradient(135deg, #ff7a3d 0%, #e8452c 100%)",
    panel: "#3a120a",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.65)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "#ff6a35",
  },
  {
    id: "orchid",
    label: "Orchid",
    background: "linear-gradient(135deg, #b06bff 0%, #6d3ce0 100%)",
    panel: "#20103f",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.65)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "#9a5cff",
  },
  {
    id: "ice",
    label: "Ice",
    background: "linear-gradient(135deg, #eaf4ff 0%, #b9d8f2 100%)",
    panel: "#12212e",
    ink: "#0d1b26",
    inkMuted: "rgba(13,27,38,0.55)",
    panelInk: "rgba(255,255,255,0.85)",
    swatch: "#c9e2f7",
  },
];

export const DEFAULT_WALLET_THEME_ID = "volt";

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