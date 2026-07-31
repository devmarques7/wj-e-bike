import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentsRealtimeTick } from "@/hooks/scheduling/useAppointmentsRealtime";
import { compareTasks, todayKey } from "@/lib/scheduling/taskPriority";
import type { AppointmentRow } from "@/hooks/scheduling/useSchedulingData";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Today's actionable jobs for a mechanic, sorted by the global priority rules
 * (bucket → emergency/VIP → score → time). Live via the appointments bus.
 */
export function useStaffTodayQueue(userId: string | undefined, limit = 6) {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const tick = useAppointmentsRealtimeTick(!!userId);

  const load = useCallback(async () => {
    if (!userId || !UUID_RE.test(userId)) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .lte("scheduled_date", todayKey())
      .in("status", ["in_progress", "confirmed", "pending", "rescheduled"])
      .order("scheduled_start_time", { ascending: true })
      .limit(60);

    const mine = ((data ?? []) as any[]).filter(
      (r) => r.assigned_mechanic_id === userId || !r.assigned_mechanic_id,
    );
    const sorted = mine.sort(compareTasks).slice(0, limit);

    const userIds = [...new Set(sorted.map((r) => r.user_id).filter(Boolean))];
    const svcIds = [...new Set(sorted.map((r) => r.service_type_id).filter(Boolean))];
    const [profRes, svcRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      svcIds.length
        ? supabase.from("service_types").select("id, name, color").in("id", svcIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map((profRes.data ?? []).map((p: any) => [p.user_id, p]));
    const svcMap = new Map((svcRes.data ?? []).map((s: any) => [s.id, s]));

    setRows(
      sorted.map((r) => ({
        ...r,
        customer_name:
          profMap.get(r.user_id)?.full_name ?? profMap.get(r.user_id)?.email ?? null,
        customer_email: profMap.get(r.user_id)?.email ?? null,
        service_name: svcMap.get(r.service_type_id)?.name ?? null,
        service_color: svcMap.get(r.service_type_id)?.color ?? null,
        mechanic_name: null,
        plan_name: null,
        plan_color: null,
        plan_tier: null,
      })) as AppointmentRow[],
    );
    setLoading(false);
  }, [userId, limit]);

  useEffect(() => {
    load();
  }, [load, tick]);

  return { rows, loading, refetch: load };
}

export default useStaffTodayQueue;
