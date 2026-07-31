import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { todayKey } from "@/lib/scheduling/taskPriority";
import { runOverdueSweep } from "@/lib/scheduling/overdueSweep";
import {
  canMechanicTake,
  runAutoDispatch,
  type DispatchTask,
} from "@/lib/scheduling/autoDispatch";

/** Only dispatch once per day per browser session. */
const dispatchKey = (date: string) => `wj.autodispatch.${date}`;
const sweepKey = (date: string) => `wj.overduesweep.${date}`;

/**
 * Global dispatch role for staff/admin surfaces: on mount it balances the day's
 * unassigned jobs across the mechanics that are actually on shift, and exposes
 * a manual "claim for me" action for whatever could not be placed.
 */
export function useAutoDispatch(opts?: {
  enabled?: boolean;
  date?: string;
  onChanged?: () => void;
}) {
  const date = opts?.date ?? todayKey();
  const { user } = useAuth();
  const { isAdmin, isStaff } = usePermissions();
  const enabled = (opts?.enabled ?? true) && (isAdmin || isStaff);
  const [running, setRunning] = useState(false);
  const onChanged = opts?.onChanged;
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;

  const dispatch = useCallback(
    async (silent = false) => {
      setRunning(true);
      try {
        const res = await runAutoDispatch(date);
        if (!silent && res.assigned > 0) {
          toast.success(`${res.assigned} job(s) distributed across the workshop`);
        }
        if (res.assigned > 0) changedRef.current?.();
        return res;
      } catch (err: any) {
        if (!silent) toast.error(err?.message ?? "Auto dispatch failed");
        return null;
      } finally {
        setRunning(false);
      }
    },
    [date],
  );

  useEffect(() => {
    if (!enabled) return;
    const key = dispatchKey(date);
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void dispatch(true);
  }, [enabled, date, dispatch]);

  /* Overdue rook: cancels tasks left behind for more than a day. */
  useEffect(() => {
    if (!enabled) return;
    const key = sweepKey(date);
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void (async () => {
      try {
        const res = await runOverdueSweep();
        if (res.canceled + res.expired > 0) {
          toast.info(
            `${res.canceled + res.expired} overdue task(s) auto-canceled and customers notified`,
          );
          changedRef.current?.();
        }
      } catch {
        /* silent — the sweep retries on the next session */
      }
    })();
  }, [enabled, date]);

  /** Mechanic self-assignment — only when the slot really fits their shift. */
  const claimTask = useCallback(
    async (task: DispatchTask) => {
      if (!user?.id) return false;
      const check = await canMechanicTake(task, user.id, task.scheduled_date);
      if (!check.ok) {
        toast.error(
          check.reason === "off_shift"
            ? "That slot is outside your shift today"
            : "You already have a job at that time",
        );
        return false;
      }
      const { error } = await supabase
        .from("appointments")
        .update({ assigned_mechanic_id: user.id })
        .eq("id", task.id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Task added to your day");
      changedRef.current?.();
      return true;
    },
    [user?.id],
  );

  /**
   * Claim a scheduling REQUEST: turns the waitlist row into a real appointment
   * assigned to the current mechanic at the requested slot.
   */
  const claimRequest = useCallback(
    async (req: {
      id: string;
      user_id: string;
      service_type_id: string | null;
      scheduled_date: string;
      scheduled_start_time: string;
      duration_minutes: number | null;
      bike_id?: string | null;
    }) => {
      if (!user?.id) return false;
      const check = await canMechanicTake(
        {
          id: req.id,
          scheduled_date: req.scheduled_date,
          scheduled_start_time: req.scheduled_start_time,
          duration_minutes: req.duration_minutes,
          assigned_mechanic_id: null,
          status: "pending",
        },
        user.id,
        req.scheduled_date,
      );
      if (!check.ok) {
        toast.error(
          check.reason === "off_shift"
            ? "That slot is outside your shift"
            : "You already have a job at that time",
        );
        return false;
      }
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          user_id: req.user_id,
          service_type_id: req.service_type_id,
          assigned_mechanic_id: user.id,
          scheduled_date: req.scheduled_date,
          scheduled_start_time: req.scheduled_start_time,
          duration_minutes: req.duration_minutes,
          status: "confirmed" as any,
          booked_via: "workshop_claim",
          bike_id: req.bike_id ?? null,
        } as any)
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return false;
      }
      await supabase
        .from("appointment_waitlist")
        .update({ status: "booked", booked_appointment_id: data.id })
        .eq("id", req.id);
      toast.success("Request accepted and added to your day");
      changedRef.current?.();
      return true;
    },
    [user?.id],
  );

  return { running, dispatch, claimTask, claimRequest, canClaim: isAdmin || isStaff };
}
