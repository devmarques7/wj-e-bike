/** Extracts a bike identifier from an E-Pass QR payload. */
export function parseEPassCode(raw: string): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === "epass" || p.toLowerCase() === "e-pass");
    const id = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
    return id ? decodeURIComponent(id) : null;
  } catch {
    // Not a URL — accept a raw id / serial
    return value.replace(/^epass[:/]/i, "");
  }
}