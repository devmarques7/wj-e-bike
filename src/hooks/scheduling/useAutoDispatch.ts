import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { todayKey } from "@/lib/scheduling/taskPriority";
import {
  canMechanicTake,
  runAutoDispatch,
  type DispatchTask,
} from "@/lib/scheduling/autoDispatch";

/** Only dispatch once per day per browser session. */
const dispatchKey = (date: string) => `wj.autodispatch.${date}`;

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

  return { running, dispatch, claimTask, canClaim: isAdmin || isStaff };
}
