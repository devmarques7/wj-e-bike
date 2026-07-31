/**
 * Plan entitlements are stored in the database (plan_versions.entitlements) and
 * seeded per plan. Nothing here invents values — this module only gives the
 * JSON a type and safe defaults for rows written before the column existed.
 */
export type PlanEntitlements = {
  /** -1 means unlimited. */
  services_per_year: number;
  priority_booking: boolean;
  accessory_discount_pct: number;
  loaner_bike: boolean;
  pickup_delivery: boolean;
  insurance_included: boolean;
  concierge: boolean;
  urgent_service_included: boolean;
  urgent_service_fee_eur: number;
  reward_points_multiplier: number;
  support: "email" | "chat_24_7" | "concierge" | string;
  booking_window_days: number;
};

export const EMPTY_ENTITLEMENTS: PlanEntitlements = {
  services_per_year: 0,
  priority_booking: false,
  accessory_discount_pct: 0,
  loaner_bike: false,
  pickup_delivery: false,
  insurance_included: false,
  concierge: false,
  urgent_service_included: false,
  urgent_service_fee_eur: 0,
  reward_points_multiplier: 1,
  support: "email",
  booking_window_days: 14,
};

/** Normalises the raw jsonb column into a fully-populated object. */
export function parseEntitlements(raw: unknown): PlanEntitlements {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_ENTITLEMENTS };
  const v = raw as Record<string, unknown>;
  const num = (k: keyof PlanEntitlements) =>
    typeof v[k] === "number" ? (v[k] as number) : Number(v[k] ?? EMPTY_ENTITLEMENTS[k]);
  const bool = (k: keyof PlanEntitlements) => Boolean(v[k] ?? EMPTY_ENTITLEMENTS[k]);
  return {
    services_per_year: num("services_per_year"),
    priority_booking: bool("priority_booking"),
    accessory_discount_pct: num("accessory_discount_pct"),
    loaner_bike: bool("loaner_bike"),
    pickup_delivery: bool("pickup_delivery"),
    insurance_included: bool("insurance_included"),
    concierge: bool("concierge"),
    urgent_service_included: bool("urgent_service_included"),
    urgent_service_fee_eur: num("urgent_service_fee_eur"),
    reward_points_multiplier: num("reward_points_multiplier") || 1,
    support: typeof v.support === "string" ? v.support : EMPTY_ENTITLEMENTS.support,
    booking_window_days: num("booking_window_days"),
  };
}

export const isUnlimitedServices = (e: PlanEntitlements) => e.services_per_year < 0;
