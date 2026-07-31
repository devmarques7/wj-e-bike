import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeHealth,
  nextRevisionDate,
  REVISION_CYCLE_MONTHS,
  type GarageBike,
} from "@/hooks/garage/useGarageBike";

/** Human label of the WJ standard maintenance cycle. */
export const REVISION_LABEL = `${REVISION_CYCLE_MONTHS}-month standard cycle`;

export interface BikeOwner {
  customerId: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

const BIKE_COLUMNS =
  "id, customer_id, model, serial, color, image_url, km, purchased_at, last_service_at, next_service_at, services_completed";

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Resolves any bike from an E-Pass identifier (bike UUID or serial) and loads
 * its owner + the shared garage health model. Staff/admin can read every bike,
 * customers only their own (enforced by RLS).
 */
export function useBikeById(identifier?: string | null) {
  const [bike, setBike] = useState<(GarageBike & { customer_id: string }) | null>(null);
  const [owner, setOwner] = useState<BikeOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = (identifier ?? "").trim();
    if (!id) {
      setBike(null);
      setOwner(null);
      setLoading(false);
      setError("No bike identifier provided.");
      return;
    }
    setLoading(true);
    setError(null);

    let query = supabase.from("customer_bikes").select(BIKE_COLUMNS).limit(1);
    query = isUuid(id) ? query.eq("id", id) : query.ilike("serial", id);
    const { data, error: bikeError } = await query.maybeSingle();

    if (bikeError || !data) {
      setBike(null);
      setOwner(null);
      setError(bikeError?.message ?? "No bike found for this E-Pass.");
      setLoading(false);
      return;
    }

    const row = data as GarageBike & { customer_id: string };
    setBike(row);

    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id, user_id")
      .eq("id", row.customer_id)
      .maybeSingle();

    if (profile) {
      let name: string | null = null;
      let email: string | null = null;
      let phone: string | null = null;
      if (profile.user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        name = p?.full_name ?? null;
        email = p?.email ?? null;
        phone = (p as { phone?: string | null } | null)?.phone ?? null;
      }
      setOwner({ customerId: profile.id, userId: profile.user_id ?? null, name, email, phone });
    } else {
      setOwner(null);
    }
    setLoading(false);
  }, [identifier]);

  useEffect(() => {
    void load();
  }, [load]);

  const health = useMemo(() => computeHealth(bike), [bike]);
  const nextRevision = useMemo(() => nextRevisionDate(bike), [bike]);
  const daysToRevision = nextRevision
    ? Math.round((nextRevision.getTime() - Date.now()) / 86400000)
    : null;

  return { bike, owner, loading, error, health, nextRevision, daysToRevision, refetch: load };
}
