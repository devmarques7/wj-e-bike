import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Standard WJ maintenance cycle: a full revision every 3 months. */
export const REVISION_CYCLE_MONTHS = 3;
/** Reference service interval in km used by the health model. */
export const REVISION_CYCLE_KM = 2000;

export interface GarageBike {
  id: string;
  model: string;
  serial: string | null;
  color: string | null;
  image_url: string | null;
  km: number;
  purchased_at: string | null;
  last_service_at: string | null;
  next_service_at: string | null;
  services_completed: number;
}

export interface HealthMetric {
  key: string;
  label: string;
  value: number; // 0-100
  unit: string;
  detail: string;
  /** Visual hint for the mini chart used on the card. */
  chart: "ring" | "bars" | "wave";
}

const clamp = (n: number) => Math.max(4, Math.min(100, Math.round(n)));

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 +
  (to.getMonth() - from.getMonth()) +
  (to.getDate() - from.getDate()) / 30;

/**
 * Deterministic e-bike health model.
 * Every score is derived from real bike data (age, km, service history) using
 * the generally accepted wear curves for e-bike components.
 */
export function computeHealth(bike: GarageBike | null) {
  const now = new Date();
  const km = bike?.km ?? 0;
  const ageMonths = bike?.purchased_at
    ? Math.max(0, monthsBetween(new Date(bike.purchased_at), now))
    : 0;
  const sinceServiceMonths = bike?.last_service_at
    ? Math.max(0, monthsBetween(new Date(bike.last_service_at), now))
    : ageMonths;
  const kmSinceService = Math.max(
    0,
    km - (bike?.services_completed ?? 0) * REVISION_CYCLE_KM,
  );

  // Battery: ~ 500 full cycles, 1 cycle ≈ 60 km, + calendar ageing.
  const battery = clamp(100 - (km / 60 / 500) * 100 * 0.8 - ageMonths * 0.45);
  // Brake pads: ~ 1500 km per set.
  const brakes = clamp(100 - (kmSinceService / 1500) * 100);
  // Drivetrain (chain / cassette): ~ 2500 km.
  const drivetrain = clamp(100 - (kmSinceService / 2500) * 100);
  // Tyres: ~ 4000 km.
  const tyres = clamp(100 - (km / 4000) * 100 + (bike?.services_completed ?? 0) * 6);
  // Frame & torque: mostly calendar + service compliance.
  const frame = clamp(100 - ageMonths * 0.6 - sinceServiceMonths * 1.4);
  // Service compliance against the 3-month cycle.
  const compliance = clamp(100 - (sinceServiceMonths / REVISION_CYCLE_MONTHS) * 60);

  const metrics: HealthMetric[] = [
    {
      key: "battery",
      label: "Battery",
      value: battery,
      unit: "%",
      detail: `${Math.round(km / 60)} charge cycles`,
      chart: "ring",
    },
    {
      key: "brakes",
      label: "Brakes",
      value: brakes,
      unit: "%",
      detail: `${Math.round(kmSinceService)} km on pads`,
      chart: "ring",
    },
    {
      key: "drivetrain",
      label: "Drivetrain",
      value: drivetrain,
      unit: "%",
      detail: "Chain & cassette wear",
      chart: "bars",
    },
    {
      key: "tyres",
      label: "Tyres",
      value: tyres,
      unit: "%",
      detail: `${km} km total`,
      chart: "bars",
    },
    {
      key: "frame",
      label: "Frame & bolts",
      value: frame,
      unit: "%",
      detail: "Torque & alignment",
      chart: "wave",
    },
    {
      key: "compliance",
      label: "Service cycle",
      value: compliance,
      unit: "%",
      detail: `${REVISION_CYCLE_MONTHS}-month standard`,
      chart: "wave",
    },
  ];

  const overall = Math.round(
    metrics.reduce((s, m) => s + m.value, 0) / metrics.length,
  );

  return { metrics, overall, sinceServiceMonths, kmSinceService };
}

/** Next revision date based on the standard 3-month cycle. */
export function nextRevisionDate(bike: GarageBike | null): Date | null {
  if (!bike) return null;
  if (bike.next_service_at) return new Date(bike.next_service_at);
  const base = bike.last_service_at ?? bike.purchased_at;
  if (!base) return null;
  const d = new Date(base);
  d.setMonth(d.getMonth() + REVISION_CYCLE_MONTHS);
  return d;
}

/**
 * Loads every bike the signed-in rider owns plus the derived health model.
 * Reused by the Garage page and any component that needs bike condition data.
 */
export function useGarageBike(bikeIdParam?: string | null) {
  const { user } = useAuth();
  const [bikes, setBikes] = useState<GarageBike[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(bikeIdParam ?? null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user?.id) {
      setBikes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.id) {
      const { data } = await supabase
        .from("customer_bikes")
        .select(
          "id, model, serial, color, image_url, km, purchased_at, last_service_at, next_service_at, services_completed",
        )
        .eq("customer_id", profile.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      setBikes((data ?? []) as GarageBike[]);
    } else {
      setBikes([]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const bike = useMemo(
    () => bikes.find((b) => b.id === (selectedId ?? bikeIdParam)) ?? bikes[0] ?? null,
    [bikes, selectedId, bikeIdParam],
  );

  const health = useMemo(() => computeHealth(bike), [bike]);
  const nextRevision = useMemo(() => nextRevisionDate(bike), [bike]);
  const daysToRevision = nextRevision
    ? Math.round((nextRevision.getTime() - Date.now()) / 86400000)
    : null;

  return {
    bikes,
    bike,
    selectBike: setSelectedId,
    loading,
    health,
    nextRevision,
    daysToRevision,
    refetch: fetchAll,
  };
}