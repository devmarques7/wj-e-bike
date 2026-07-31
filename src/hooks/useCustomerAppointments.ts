import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type QcProgress = {
  id: string;
  stage_name: string;
  stage_position: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  task_results: any;
};

export type CustomerAppointment = {
  id: string;
  user_id: string;
  service_type_id: string | null;
  assigned_mechanic_id: string | null;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  duration_minutes: number | null;
  status:
    | "pending"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "canceled"
    | "no_show"
    | "rescheduled";
  priority: "normal" | "vip" | "emergency";
  notes: string | null;
  work_started_at: string | null;
  work_ended_at: string | null;
  extra_charge_eur: number | null;
  is_covered_by_plan: boolean | null;
  created_at: string;
  updated_at: string | null;
  // joined
  service_name: string | null;
  service_color: string | null;
  service_reward_points: number | null;
  mechanic_name: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  bike_model: string | null;
  qc_progress: QcProgress[];
};

/**
 * Customer-scoped appointments loader with realtime updates.
 * Returns every appointment the logged-in user owns (past + upcoming),
 * joined with service, mechanic, bike and QC progress data.
 */
export function useCustomerAppointments() {
  const { user } = useAuth();
  const uid = user?.id;
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);

  const fetchAll = useCallback(async () => {
    if (!uid) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: appts, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", uid)
        .order("scheduled_date", { ascending: false })
        .order("scheduled_start_time", { ascending: false });
      if (error) throw error;

      const rows = appts ?? [];
      const svcIds = Array.from(
        new Set(rows.map((a) => a.service_type_id).filter(Boolean) as string[]),
      );
      const mechIds = Array.from(
        new Set(rows.map((a) => a.assigned_mechanic_id).filter(Boolean) as string[]),
      );
      const apptIds = rows.map((a) => a.id);

      const [svcRes, staffRes, qcRes, bikeRes] = await Promise.all([
        svcIds.length
          ? supabase
              .from("service_types")
              .select("id, name, color, reward_points")
              .in("id", svcIds)
          : Promise.resolve({ data: [] as any[] }),
        // Customers cannot read staff profiles directly (RLS), so resolve the
        // mechanic / completed-by names through a security-definer function.
        apptIds.length
          ? supabase.rpc("get_appointment_staff", { _appointment_ids: apptIds })
          : Promise.resolve({ data: [] as any[] }),
        apptIds.length
          ? supabase
              .from("appointment_qc_progress")
              .select(
                "id, appointment_id, stage_name, stage_position, started_at, completed_at, notes, task_results",
              )
              .in("appointment_id", apptIds)
              .order("stage_position", { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("customer_bikes")
          .select("model, customer_id, customer_profiles!inner(user_id)")
          .eq("customer_profiles.user_id", uid)
          .limit(1),
      ]);

      const svcMap = new Map((svcRes.data ?? []).map((s: any) => [s.id, s]));
      const staffMap = new Map(
        ((staffRes as any)?.data ?? []).map((s: any) => [s.appointment_id, s]),
      );
      const qcMap = new Map<string, QcProgress[]>();
      (qcRes.data ?? []).forEach((q: any) => {
        const arr = qcMap.get(q.appointment_id) ?? [];
        arr.push(q);
        qcMap.set(q.appointment_id, arr);
      });
      const bikeModel = (bikeRes as any)?.data?.[0]?.model ?? null;

      setAppointments(
        rows.map((a) => {
          const s = a.service_type_id ? (svcMap.get(a.service_type_id) as any) : null;
          const st = staffMap.get(a.id) as any;
          return {
            ...a,
            service_name: s?.name ?? null,
            service_color: s?.color ?? null,
            service_reward_points: s?.reward_points ?? null,
            mechanic_name: st?.mechanic_name ?? st?.completed_by_name ?? null,
            completed_by: st?.completed_by ?? (a as any).completed_by ?? null,
            completed_by_name: st?.completed_by_name ?? null,
            bike_model: bikeModel,
            qc_progress: qcMap.get(a.id) ?? [],
          } as CustomerAppointment;
        }),
      );
    } catch (err) {
      console.error("[useCustomerAppointments]", err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: refetch on any change to this user's appointments or their qc progress.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`customer-appointments-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${uid}` },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_qc_progress" },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, fetchAll]);

  return { loading, appointments, refetch: fetchAll };
}