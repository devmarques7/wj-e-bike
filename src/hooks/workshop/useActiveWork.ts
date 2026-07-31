import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AppointmentRow } from "@/hooks/scheduling/useSchedulingData";

/**
 * Globally-available "job in progress" for the logged in staff/admin.
 * Fetches the current in_progress appointment (assigned to me, or any if admin)
 * and keeps it live through Supabase realtime, so the floating shift pill can
 * surface the running Quality Control job on every page.
 */
export function useActiveWork() {
  const { user } = useAuth();
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActive = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setAppointment(null);
      setLoading(false);
      return;
    }
    let q = supabase
      .from("appointments")
      .select("*")
      .eq("status", "in_progress")
      .not("work_started_at", "is", null)
      .order("work_started_at", { ascending: false })
      .limit(1);
    if (user?.role !== "admin") q = q.eq("assigned_mechanic_id", uid);

    const { data } = await q;
    const row: any = data?.[0] ?? null;
    if (!row) {
      setAppointment(null);
      setLoading(false);
      return;
    }

    const [profRes, svcRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email").eq("user_id", row.user_id).maybeSingle(),
      row.service_type_id
        ? supabase.from("service_types").select("name, color").eq("id", row.service_type_id).maybeSingle()
        : Promise.resolve({ data: null as any }),
    ]);

    setAppointment({
      ...row,
      customer_name: profRes.data?.full_name ?? null,
      customer_email: profRes.data?.email ?? null,
      mechanic_name: user?.name ?? null,
      service_name: svcRes.data?.name ?? null,
      service_color: svcRes.data?.color ?? null,
      plan_name: null,
      plan_color: null,
      plan_tier: null,
    } as AppointmentRow);
    setLoading(false);
  }, [user?.role, user?.name]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  useEffect(() => {
    const channel = supabase
      .channel("active-work-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () =>
        fetchActive(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActive]);

  return { appointment, loading, refetch: fetchActive };
}
