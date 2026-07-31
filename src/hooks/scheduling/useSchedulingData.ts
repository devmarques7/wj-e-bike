import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type BusinessHour = {
  id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  max_parallel_services: number;
  buffer_minutes: number;
  valid_from: string;
  valid_until: string | null;
};

export type BusinessHourException = {
  id: string;
  exception_date: string;
  exception_type: "closed" | "reduced_hours" | "extended_hours" | "special_event";
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string;
  is_public_holiday: boolean;
};

export type ServiceType = {
  id: string;
  name: string;
  slug: string;
  duration_minutes: number;
  base_price: number | null;
  priority_score: number;
  icon: string | null;
  color: string | null;
  covered_by_plan_levels: number[] | null;
  is_emergency: boolean;
  is_active: boolean;
};

export type Mechanic = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  weekly_appointments: number;
  weekly_capacity: number;
};

export type AppointmentRow = {
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
  priority_score: number;
  customer_name: string | null;
  customer_email: string | null;
  mechanic_name: string | null;
  service_name: string | null;
  service_color: string | null;
  plan_name: string | null;
  plan_color: string | null;
  plan_tier: number | null;
  updated_at: string | null;
  work_started_at: string | null;
  work_ended_at: string | null;
};

// Extra fields carried straight through from the appointments row via `select("*")`.
export interface AppointmentRowFull extends AppointmentRow {
  subscription_id: string | null;
  subscription_plan_level: number | null;
  is_covered_by_plan: boolean | null;
  extra_charge_eur: number | null;
  reschedule_of: string | null;
  reschedule_count: number | null;
  actual_duration_minutes: number | null;
  confirmation_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  booked_via: string | null;
  notes: string | null;
  created_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Keep the most recent currently-valid row per day_of_week. */
function pickLatestPerDay(rows: BusinessHour[]): BusinessHour[] {
  const today = todayISO();
  const valid = rows.filter(
    (r) => r.valid_from <= today && (r.valid_until === null || r.valid_until >= today),
  );
  const map = new Map<number, BusinessHour>();
  for (const r of valid) {
    const existing = map.get(r.day_of_week);
    if (!existing || existing.valid_from < r.valid_from) map.set(r.day_of_week, r);
  }
  return Array.from(map.values()).sort((a, b) => a.day_of_week - b.day_of_week);
}

/* ------------------------------------------------------------------ */
/* Hook                                                               */
/* ------------------------------------------------------------------ */

export function useSchedulingData(opts?: { date?: string; customerUserId?: string; bikeId?: string | null }) {
  const date = opts?.date ?? todayISO();
  const customerUserId = opts?.customerUserId ?? null;
  const bikeId = opts?.bikeId ?? null;

  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [exceptions, setExceptions] = useState<BusinessHourException[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bhRes, exRes, stRes, rolesRes] = await Promise.all([
        supabase.from("business_hours").select("*"),
        supabase
          .from("business_hour_exceptions")
          .select("*")
          .gte("exception_date", todayISO())
          .order("exception_date", { ascending: true }),
        supabase
          .from("service_types")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
        customerUserId
          ? Promise.resolve({ data: [] as any[], error: null })
          : supabase.from("user_roles").select("user_id").eq("role", "staff"),
      ]);

      if (bhRes.error) throw bhRes.error;
      if (exRes.error) throw exRes.error;
      if (stRes.error) throw stRes.error;
      if ((rolesRes as any).error) throw (rolesRes as any).error;

      setBusinessHours(pickLatestPerDay((bhRes.data ?? []) as BusinessHour[]));
      setExceptions((exRes.data ?? []) as BusinessHourException[]);
      setServiceTypes((stRes.data ?? []) as ServiceType[]);

      const staffIds = ((rolesRes as any).data ?? []).map((r: any) => r.user_id);
      let mechs: Mechanic[] = [];
      if (staffIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, avatar_url")
          .in("user_id", staffIds);

        // weekly counts
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const { data: weekAppts } = await supabase
          .from("appointments")
          .select("assigned_mechanic_id")
          .gte("scheduled_date", weekStart.toISOString().slice(0, 10))
          .lte("scheduled_date", weekEnd.toISOString().slice(0, 10))
          .in("status", ["pending", "confirmed", "in_progress", "completed"]);

        const counts = new Map<string, number>();
        (weekAppts ?? []).forEach((a) => {
          if (!a.assigned_mechanic_id) return;
          counts.set(a.assigned_mechanic_id, (counts.get(a.assigned_mechanic_id) ?? 0) + 1);
        });

        mechs = (profs ?? []).map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          weekly_appointments: counts.get(p.user_id) ?? 0,
          weekly_capacity: 40, // 8 slots/day × 5 days
        }));
      }
      setMechanics(mechs);

      // Appointments: for admin/staff -> current date; for customer -> all their appointments
      let apptQuery = supabase
        .from("appointments")
        .select("*")
        .order("scheduled_date", { ascending: false })
        .order("scheduled_start_time", { ascending: true });
      if (customerUserId) {
        apptQuery = apptQuery.eq("user_id", customerUserId);
      } else {
        apptQuery = apptQuery.eq("scheduled_date", date);
      }
      if (bikeId) apptQuery = apptQuery.eq("bike_id", bikeId);
      const { data: appts, error: aerr } = await apptQuery;
      if (aerr) throw aerr;

      const userIds = Array.from(new Set((appts ?? []).map((a) => a.user_id)));
      const mechIds = Array.from(
        new Set((appts ?? []).map((a) => a.assigned_mechanic_id).filter(Boolean) as string[]),
      );
      const svcIds = Array.from(
        new Set((appts ?? []).map((a) => a.service_type_id).filter(Boolean) as string[]),
      );

      const [profsRes, mechProfsRes, svcRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        mechIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", mechIds)
          : Promise.resolve({ data: [] as any[] }),
        svcIds.length
          ? supabase.from("service_types").select("id, name, color").in("id", svcIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.user_id, p]));
      const mechMap = new Map((mechProfsRes.data ?? []).map((p: any) => [p.user_id, p]));
      const svcMap = new Map((svcRes.data ?? []).map((s: any) => [s.id, s]));

      // Pull active subscription → plan for each customer in today's appointments
      const planMap = new Map<string, { name: string; color: string | null; tier: number | null }>();
      if (userIds.length) {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("user_id, plan_version_id, status")
          .in("user_id", userIds)
          .eq("status", "active");
        const pvIds = Array.from(new Set((subs ?? []).map((s: any) => s.plan_version_id)));
        if (pvIds.length) {
          const { data: pvs } = await supabase
            .from("plan_versions")
            .select("id, plan_id")
            .in("id", pvIds);
          const planIds = Array.from(new Set((pvs ?? []).map((p: any) => p.plan_id)));
          const { data: plans } = planIds.length
            ? await supabase
                .from("plans")
                .select("id, name, color_hex, tier_level")
                .in("id", planIds)
            : { data: [] as any[] };
          const pvToPlan = new Map((pvs ?? []).map((p: any) => [p.id, p.plan_id]));
          const planById = new Map((plans ?? []).map((p: any) => [p.id, p]));
          (subs ?? []).forEach((s: any) => {
            const planId = pvToPlan.get(s.plan_version_id);
            const plan = planId ? planById.get(planId) : null;
            if (plan) {
              planMap.set(s.user_id, {
                name: plan.name,
                color: plan.color_hex ?? null,
                tier: plan.tier_level ?? null,
              });
            }
          });
        }
      }

      setAppointments(
        (appts ?? []).map((a) => {
          const p = profMap.get(a.user_id);
          const m = a.assigned_mechanic_id ? mechMap.get(a.assigned_mechanic_id) : null;
          const s = a.service_type_id ? svcMap.get(a.service_type_id) : null;
          const pl = planMap.get(a.user_id) ?? null;
          return {
            ...a,
            customer_name: p?.full_name ?? null,
            customer_email: p?.email ?? null,
            mechanic_name: m?.full_name ?? null,
            service_name: s?.name ?? null,
            service_color: s?.color ?? null,
            plan_name: pl?.name ?? null,
            plan_color: pl?.color ?? null,
            plan_tier: pl?.tier ?? null,
          } as AppointmentRow;
        }),
      );
    } catch (err: any) {
      console.error("[scheduling] fetch error", err);
      toast.error(err.message ?? "Falha ao carregar agendamento");
    } finally {
      setLoading(false);
    }
  }, [date, customerUserId, bikeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: refresh whenever this scope's appointments change
  useEffect(() => {
    const channel = supabase
      .channel(`sched-${customerUserId ?? "all"}-${bikeId ?? "any"}-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          ...(customerUserId ? { filter: `user_id=eq.${customerUserId}` } : {}),
        },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerUserId, bikeId, date, fetchAll]);

  /* ------------------- mutations ------------------- */

  /** Save a new version of business hours for a day (never edits past rows). */
  const saveBusinessHourForDay = useCallback(
    async (input: {
      day_of_week: number;
      is_open: boolean;
      open_time: string | null;
      close_time: string | null;
      max_parallel_services?: number;
      buffer_minutes?: number;
    }) => {
      const valid_from = todayISO();
      const { error } = await supabase
        .from("business_hours")
        .upsert(
          {
            day_of_week: input.day_of_week,
            is_open: input.is_open,
            open_time: input.is_open ? input.open_time : null,
            close_time: input.is_open ? input.close_time : null,
            max_parallel_services: input.max_parallel_services ?? 3,
            buffer_minutes: input.buffer_minutes ?? 15,
            valid_from,
          },
          { onConflict: "day_of_week,valid_from" },
        );
      if (error) {
        toast.error(error.message);
        return false;
      }
      return true;
    },
    [],
  );

  const saveAllBusinessHours = useCallback(
    async (rows: Pick<BusinessHour, "day_of_week" | "is_open" | "open_time" | "close_time">[]) => {
      const results = await Promise.all(rows.map((r) => saveBusinessHourForDay(r)));
      const ok = results.every(Boolean);
      if (ok) {
        toast.success("Horários atualizados");
        fetchAll();
      }
      return ok;
    },
    [saveBusinessHourForDay, fetchAll],
  );

  const updateAppointmentStatus = useCallback(
    async (id: string, status: AppointmentRow["status"]) => {
      const patch: any = { status };
      if (status === "in_progress") patch.work_started_at = new Date().toISOString();
      if (status === "completed") patch.work_ended_at = new Date().toISOString();
      const { error } = await supabase.from("appointments").update(patch).eq("id", id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Estado atualizado");
      fetchAll();
      return true;
    },
    [fetchAll],
  );

  const updateAppointmentFields = useCallback(
    async (
      id: string,
      patch: Partial<{
        assigned_mechanic_id: string | null;
        service_type_id: string | null;
        scheduled_date: string;
        scheduled_start_time: string;
        scheduled_end_time: string | null;
        duration_minutes: number | null;
        status: AppointmentRow["status"];
        notes: string | null;
      }>,
    ) => {
      const { error } = await supabase.from("appointments").update(patch).eq("id", id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Agendamento atualizado");
      fetchAll();
      return true;
    },
    [fetchAll],
  );

  const rescheduleAppointment = useCallback(
    async (id: string, date: string, startTime: string, durationMinutes?: number | null) => {
      const patch: any = {
        scheduled_date: date,
        scheduled_start_time: startTime,
        status: "confirmed",
      };
      if (durationMinutes && durationMinutes > 0) {
        const [h, m] = startTime.split(":").map(Number);
        const end = new Date(2000, 0, 1, h, m + durationMinutes);
        patch.scheduled_end_time = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`;
        patch.duration_minutes = durationMinutes;
      }
      const { error } = await supabase
        .from("appointments")
        .update(patch)
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Agendamento reagendado");
      fetchAll();
      return true;
    },
    [fetchAll],
  );

  const cancelAppointment = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "canceled" })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Agendamento cancelado");
      fetchAll();
      return true;
    },
    [fetchAll],
  );

  const deleteAppointment = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Agendamento removido");
      fetchAll();
      return true;
    },
    [fetchAll],
  );

  return {
    loading,
    businessHours,
    exceptions,
    serviceTypes,
    mechanics,
    appointments,
    refetch: fetchAll,
    saveBusinessHourForDay,
    saveAllBusinessHours,
    updateAppointmentStatus,
    updateAppointmentFields,
    rescheduleAppointment,
    cancelAppointment,
    deleteAppointment,
  };
}