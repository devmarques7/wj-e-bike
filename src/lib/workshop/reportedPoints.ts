/**
 * Extracts the discrete "reported points" (problems reported by the customer)
 * from free-text appointment notes / diagnosis summaries.
 *
 * The customer diagnosis chat stores answers as tags and bullet lines, so we
 * split on newlines, bullets and common separators and normalize the result.
 */
export function extractReportedPoints(...sources: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  sources
    .filter((s): s is string => !!s && !!s.trim())
    .forEach((raw) => {
      raw
        .split(/\r?\n|(?:^|\s)[-•*]\s+|;\s+/g)
        .map((part) => part.replace(/^[\s\-•*\d.)]+/, "").trim())
        .filter((part) => part.length > 2)
        .forEach((part) => {
          const key = part.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          out.push(part.length > 180 ? `${part.slice(0, 177)}…` : part);
        });
    });

  return out;
}
