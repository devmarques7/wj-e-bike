import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { pauseWork, resumeWork, clearWorkPause } from "@/lib/workshop/workPause";

export type ShiftStatus = "idle" | "active" | "paused" | "completed";

export type ShiftRow = {
  id: string;
  shift_date: string;
  clock_in: string | null;
  clock_out: string | null;
  worked_minutes: number;
  scheduled_minutes: number;
  status: string;
};

const SELECT_COLS =
  "id, shift_date, clock_in, clock_out, worked_minutes, scheduled_minutes, status";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parseHM = (t: string | null) => {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

// ---- Module-level shared store so every consumer (ShiftTag, ShiftTracker, ...) stays in sync ----
type State = {
  row: ShiftRow | null;
  loading: boolean;
  working: boolean;
  userId: string;
};

let state: State = { row: null, loading: true, working: false, userId: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  emit();
};

async function loadFor(userId: string) {
  if (!userId) return;
  const today = ymd(new Date());
  const { data } = await supabase
    .from("staff_shifts")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("shift_date", today)
    .maybeSingle();
  setState({ row: (data as ShiftRow | null) ?? null, loading: false });
}

async function getScheduledMinutesForToday(userId: string) {
  const today = ymd(new Date());
  const dow = new Date().getDay();
  const { data } = await supabase
    .from("staff_schedules")
    .select("day_of_week, is_working, start_time, end_time")
    .eq("staff_id", userId)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`);
  const sch = (data ?? []).find((s: any) => s.day_of_week === dow);
  if (!sch || !sch.is_working) return 0;
  return Math.max(0, parseHM(sch.end_time) - parseHM(sch.start_time));
}

async function start(userId: string) {
  if (!userId || state.working) return;
  setState({ working: true });
  try {
    const today = ymd(new Date());
    const scheduled = await getScheduledMinutesForToday(userId);
    const { data, error } = await supabase
      .from("staff_shifts")
      .insert({
        user_id: userId,
        shift_date: today,
        clock_in: new Date().toISOString(),
        worked_minutes: 0,
        scheduled_minutes: scheduled,
        status: "active",
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    setState({ row: data as ShiftRow });
    clearWorkPause();
    toast.success("Shift started");
  } catch (e: any) {
    toast.error(e.message ?? "Failed to start shift");
  } finally {
    setState({ working: false });
  }
}

async function resume() {
  const row = state.row;
  if (!row || state.working) return;
  setState({ working: true });
  try {
    const { data, error } = await supabase
      .from("staff_shifts")
      .update({ clock_in: new Date().toISOString(), status: "active" })
      .eq("id", row.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    setState({ row: data as ShiftRow });
    await resumeWork(state.userId);
    toast.success("Shift resumed");
  } catch (e: any) {
    toast.error(e.message ?? "Failed to resume");
  } finally {
    setState({ working: false });
  }
}

async function pause() {
  const row = state.row;
  if (!row || state.working || row.status !== "active") return;
  setState({ working: true });
  try {
    const added = row.clock_in
      ? Math.max(0, Math.floor((Date.now() - new Date(row.clock_in).getTime()) / 60000))
      : 0;
    const { data, error } = await supabase
      .from("staff_shifts")
      .update({
        worked_minutes: (row.worked_minutes ?? 0) + added,
        clock_in: null,
        status: "paused",
      })
      .eq("id", row.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    setState({ row: data as ShiftRow });
    await pauseWork(state.userId);
    toast.success("Shift paused — running job on hold");
  } catch (e: any) {
    toast.error(e.message ?? "Failed to pause");
  } finally {
    setState({ working: false });
  }
}

async function finish() {
  const row = state.row;
  if (!row || state.working) return;
  setState({ working: true });
  try {
    const added =
      row.status === "active" && row.clock_in
        ? Math.max(0, Math.floor((Date.now() - new Date(row.clock_in).getTime()) / 60000))
        : 0;
    const { data, error } = await supabase
      .from("staff_shifts")
      .update({
        worked_minutes: (row.worked_minutes ?? 0) + added,
        clock_out: new Date().toISOString(),
        clock_in: null,
        status: "completed",
      })
      .eq("id", row.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    setState({ row: data as ShiftRow });
    clearWorkPause();
    toast.success("Shift finished");
  } catch (e: any) {
    toast.error(e.message ?? "Failed to finish");
  } finally {
    setState({ working: false });
  }
}

/**
 * Make sure the shift clock is running (used when a mechanic starts a job).
 * Starts the shift if none exists today, resumes it if paused.
 */
export async function ensureShiftActive(userId?: string) {
  const uid = userId || state.userId;
  if (!uid) return;
  if (state.userId !== uid || (!state.row && state.loading)) {
    setState({ userId: uid });
    await loadFor(uid);
  }
  const row = state.row;
  if (!row) {
    await start(uid);
    return;
  }
  if (row.status === "paused") await resume();
}

/**
 * Shared shift state hook. ShiftTag (floating pill) and ShiftTracker (dashboard
 * card) both consume this, so timer + actions (start/pause/resume/finish) stay
 * perfectly in sync — the floating pill is just an extension of the same state.
 */
export function useShift() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [, force] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Subscribe to shared store
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // Load when user available / changes
  useEffect(() => {
    if (!userId) return;
    if (state.userId !== userId) {
      setState({ userId, loading: true, row: null });
    }
    loadFor(userId);
  }, [userId]);

  // 1s ticker for live elapsed display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const status: ShiftStatus = useMemo(() => {
    const row = state.row;
    if (!row) return "idle";
    if (row.status === "active") return "active";
    if (row.status === "paused") return "paused";
    if (row.status === "completed" || row.clock_out) return "completed";
    return "idle";
  }, [state.row]);

  const elapsedSec = useMemo(() => {
    const row = state.row;
    const base = (row?.worked_minutes ?? 0) * 60;
    if (status === "active" && row?.clock_in) {
      return base + Math.max(0, Math.floor((now - new Date(row.clock_in).getTime()) / 1000));
    }
    return base;
  }, [state.row, now, status]);

  return {
    userId,
    row: state.row,
    loading: state.loading,
    working: state.working,
    status,
    elapsedSec,
    start: () => start(userId),
    resume,
    pause,
    finish,
    reload: () => loadFor(userId),
  };
}

export default useShift;