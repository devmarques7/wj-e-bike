import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentsRealtimeTick } from "@/hooks/scheduling/useAppointmentsRealtime";
import type { AppointmentRow } from "@/hooks/scheduling/useSchedulingData";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { localYmd as ymd } from "@/lib/scheduling/localDate";

/**
 * "What do I do next?" — resolves the running job first, otherwise the closest
 * upcoming appointment assigned to the mechanic (or still unassigned today).
 * Live-refreshed through the shared appointments realtime bus.
 */
export function useStaffNextAppointment(userId: string | undefined) {
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const tick = useAppointmentsRealtimeTick(!!userId);

  const load = useCallback(async () => {
    if (!userId || !UUID_RE.test(userId)) {
      setAppointment(null);
      setLoading(false);
      return;
    }
    const today = ymd(new Date());

    const { data } = await supabase
      .from("appointments")
      .select("*")
      .gte("scheduled_date", today)
      .in("status", ["in_progress", "confirmed", "pending"])
      .order("scheduled_date", { ascending: true })
      .order("scheduled_start_time", { ascending: true })
      .limit(40);

    const rows = ((data ?? []) as any[]).filter(
      (r) => r.assigned_mechanic_id === userId || !r.assigned_mechanic_id,
    );
    const running = rows.find((r) => r.status === "in_progress");
    const row = running ?? rows[0] ?? null;

    if (!row) {
      setAppointment(null);
      setLoading(false);
      return;
    }

    const [profRes, svcRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email").eq("user_id", row.user_id).maybeSingle(),
      row.service_type_id
        ? supabase
            .from("service_types")
            .select("name, color")
            .eq("id", row.service_type_id)
            .maybeSingle()
        : Promise.resolve({ data: null as any }),
    ]);

    setAppointment({
      ...row,
      customer_name: profRes.data?.full_name ?? profRes.data?.email ?? null,
      customer_email: profRes.data?.email ?? null,
      mechanic_name: null,
      service_name: svcRes.data?.name ?? null,
      service_color: svcRes.data?.color ?? null,
      plan_name: null,
      plan_color: null,
      plan_tier: null,
    } as AppointmentRow);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load, tick]);

  return { appointment, loading, refetch: load };
}

export default useStaffNextAppointment;