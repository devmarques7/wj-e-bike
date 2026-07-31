import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractReportedPoints } from "@/lib/workshop/reportedPoints";

export type BriefingBike = {
  id: string;
  model: string;
  serial: string | null;
  color: string | null;
  km: number;
  last_service_at: string | null;
  next_service_at: string | null;
  services_completed: number;
};

export type BriefingHistoryItem = {
  id: string;
  scheduled_date: string;
  status: string;
  service_name: string | null;
  notes: string | null;
};

export type BikeBriefing = {
  notes: string | null;
  reportedPoints: string[];
  priority: string | null;
  bookedVia: string | null;
  isCoveredByPlan: boolean | null;
  extraChargeEur: number | null;
  durationMinutes: number | null;
  serviceName: string | null;
  serviceDescription: string | null;
  bike: BriefingBike | null;
  history: BriefingHistoryItem[];
};

export function useBikeBriefing(appointmentId: string | null | undefined, enabled = true) {
  const [briefing, setBriefing] = useState<BikeBriefing | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    try {
      const { data: appt } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .maybeSingle();
      if (!appt) {
        setBriefing(null);
        return;
      }

      const [bikeRes, serviceRes, historyRes] = await Promise.all([
        appt.bike_id
          ? supabase
              .from("customer_bikes")
              .select("id, model, serial, color, km, last_service_at, next_service_at, services_completed")
              .eq("id", appt.bike_id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
        appt.service_type_id
          ? supabase
              .from("service_types")
              .select("name, description")
              .eq("id", appt.service_type_id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("appointments")
          .select("id, scheduled_date, status, notes, service_type_id")
          .eq(appt.bike_id ? "bike_id" : "user_id", appt.bike_id ?? appt.user_id)
          .neq("id", appt.id)
          .order("scheduled_date", { ascending: false })
          .limit(5),
      ]);

      const historyRows = (historyRes as any)?.data ?? [];
      const serviceIds = Array.from(
        new Set(historyRows.map((h: any) => h.service_type_id).filter(Boolean)),
      );
      let namesById: Record<string, string> = {};
      if (serviceIds.length) {
        const { data: svc } = await supabase
          .from("service_types")
          .select("id, name")
          .in("id", serviceIds as string[]);
        namesById = Object.fromEntries((svc ?? []).map((s: any) => [s.id, s.name]));
      }

      setBriefing({
        notes: appt.notes ?? null,
        reportedPoints: extractReportedPoints(appt.notes),
        priority: appt.priority ?? null,
        bookedVia: appt.booked_via ?? null,
        isCoveredByPlan: appt.is_covered_by_plan ?? null,
        extraChargeEur: appt.extra_charge_eur ?? null,
        durationMinutes: appt.duration_minutes ?? null,
        serviceName: (serviceRes as any)?.data?.name ?? null,
        serviceDescription: (serviceRes as any)?.data?.description ?? null,
        bike: ((bikeRes as any)?.data ?? null) as BriefingBike | null,
        history: historyRows.map((h: any) => ({
          id: h.id,
          scheduled_date: h.scheduled_date,
          status: h.status,
          notes: h.notes,
          service_name: h.service_type_id ? namesById[h.service_type_id] ?? null : null,
        })),
      });
    } catch (e) {
      console.error("[briefing]", e);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (enabled && appointmentId) load();
    if (!enabled) setBriefing(null);
  }, [enabled, appointmentId, load]);

  return { briefing, loading, refetch: load };
}
