/**
 * Module-level mirror of the bike the rider is currently looking at.
 * Lets non-React layers (intent router, booking flow, edge-function payloads)
 * resolve "my bike" without guessing.
 */
export interface BikeScope {
  id: string;
  model: string;
  serial: string | null;
  km: number;
  lastServiceAt: string | null;
  nextServiceAt: string | null;
  servicesCompleted: number;
}

let current: BikeScope | null = null;
const listeners = new Set<(b: BikeScope | null) => void>();

export function setBikeScope(bike: BikeScope | null) {
  current = bike;
  listeners.forEach((l) => l(bike));
}

export function getBikeScope(): BikeScope | null {
  return current;
}

export function subscribeBikeScope(fn: (b: BikeScope | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** One-line description injected into AI prompts so the model knows the bike. */
export function bikeScopePrompt(): string {
  if (!current) return "";
  const parts = [
    `Active bike: ${current.model}`,
    current.serial ? `serial ${current.serial}` : null,
    `${current.km} km`,
    current.lastServiceAt ? `last service ${current.lastServiceAt}` : "never serviced",
    current.nextServiceAt ? `next revision due ${current.nextServiceAt}` : null,
  ].filter(Boolean);
  return `${parts.join(" · ")} (bike_id: ${current.id}). Any booking, diagnosis or service request refers to THIS bike unless the rider names another one.`;
}
