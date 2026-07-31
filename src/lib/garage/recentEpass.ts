/**
 * Session memory of E-Pass reviews.
 *
 * Whenever staff opens a scanned bike, the visit is stored in sessionStorage so
 * they can jump straight back to the last bike they were reviewing after
 * navigating away. A new scan replaces the top of the list.
 */
export interface EPassVisit {
  bikeId: string;
  model: string | null;
  serial: string | null;
  ownerName: string | null;
  imageUrl?: string | null;
  overall?: number | null;
  at: number;
}

const KEY = "wj.epass.recent";
const MAX = 5;
const EVENT = "wj:epass-recent";

export function getRecentEPassVisits(): EPassVisit[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as EPassVisit[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordEPassVisit(visit: Omit<EPassVisit, "at">) {
  if (!visit.bikeId) return;
  const list = getRecentEPassVisits().filter((v) => v.bikeId !== visit.bikeId);
  const next = [{ ...visit, at: Date.now() }, ...list].slice(0, MAX);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full / disabled — the feature is optional */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function clearRecentEPassVisits() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeRecentEPass(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
