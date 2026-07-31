import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { pauseWork, resumeWork, clearWorkPause, syncWorkPauseWithShift } from "@/lib/workshop/workPause";

export type ShiftStatus = "idle" | "active" | "paused" | "completed";

export type ShiftRow = {
  id: string;
  shift_date: string;
  clock_in: string | null;
  clock_out: string | null;
  worked_minutes: number;
  scheduled_minutes: number;
  status: string;
  /** Total paused minutes accumulated today (closed breaks only). */
  break_minutes: number;
  created_at?: string | null;
};

export type ShiftBreak = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  reason: string | null;
};

const SELECT_COLS =
  "id, shift_date, clock_in, clock_out, worked_minutes, scheduled_minutes, status, break_minutes, created_at";

const BREAK_COLS = "id, started_at, ended_at, duration_seconds, reason";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parseHM = (t: string | null) => {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

// ---- Module-level shared store so every consumer (ShiftTag, ShiftTracker, ...) stays in sync ----
type State = {
  row: ShiftRow | null;
  breaks: ShiftBreak[];
  loading: boolean;
  working: boolean;
  userId: string;
};

let state: State = { row: null, breaks: [], loading: true, working: false, userId: "" };
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
  let row = (data as ShiftRow | null) ?? null;
  // Legacy/incomplete rows: a running shift without clock_in freezes the timer
  // at worked_minutes. Backfill it so the clock keeps ticking every second.
  if (row && !row.clock_in && row.status !== "completed" && !row.clock_out) {
    const base = new Date(
      new Date(row.created_at ?? new Date().toISOString()).getTime() -
        (row.worked_minutes ?? 0) * 60_000,
    ).toISOString();
    const { data: fixed } = await supabase
      .from("staff_shifts")
      .update({ clock_in: base })
      .eq("id", row.id)
      .select(SELECT_COLS)
      .maybeSingle();
    row = (fixed as ShiftRow | null) ?? { ...row, clock_in: base };
  }
  let breaks: ShiftBreak[] = [];
  if (row) {
    const { data: br } = await supabase
      .from("staff_shift_breaks")
      .select(BREAK_COLS)
      .eq("shift_id", row.id)
      .order("started_at", { ascending: true });
    breaks = (br as ShiftBreak[] | null) ?? [];
  }
  setState({ row, breaks, loading: false });
}

/** Seconds of *closed* breaks for the current shift. */
function closedBreakSeconds(breaks: ShiftBreak[]) {
  return breaks
    .filter((b) => b.ended_at)
    .reduce(
      (acc, b) =>
        acc +
        (b.duration_seconds ??
          Math.max(
            0,
            Math.floor(
              (new Date(b.ended_at as string).getTime() - new Date(b.started_at).getTime()) / 1000,
            ),
          )),
      0,
    );
}

const openBreakOf = (breaks: ShiftBreak[]) => breaks.find((b) => !b.ended_at) ?? null;

/**
 * Net worked seconds = (reference − first clock-in) − paused time.
 * `clock_in` is written once (first entry of the day) and never overwritten.
 */
function netWorkedSeconds(row: ShiftRow | null, breaks: ShiftBreak[], nowMs: number) {
  const startRef = row?.clock_in ?? row?.created_at ?? null;
  if (!row || !startRef) return (row?.worked_minutes ?? 0) * 60;
  const open = openBreakOf(breaks);
  const endMs = row.clock_out
    ? new Date(row.clock_out).getTime()
    : open
      ? new Date(open.started_at).getTime()
      : nowMs;
  const gross = Math.max(0, Math.floor((endMs - new Date(startRef).getTime()) / 1000));
  return Math.max(0, gross - closedBreakSeconds(breaks));
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
    setState({ row: data as ShiftRow, breaks: [] });
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
    // Close the open break (if any) and roll its duration into break_minutes.
    const open = openBreakOf(state.breaks);
    let breaks = state.breaks;
    let breakMinutes = row.break_minutes ?? 0;
    if (open) {
      const endedAt = new Date();
      const dur = Math.max(
        0,
        Math.floor((endedAt.getTime() - new Date(open.started_at).getTime()) / 1000),
      );
      await supabase
        .from("staff_shift_breaks")
        .update({ ended_at: endedAt.toISOString(), duration_seconds: dur })
        .eq("id", open.id);
      breaks = state.breaks.map((b) =>
        b.id === open.id
          ? { ...b, ended_at: endedAt.toISOString(), duration_seconds: dur }
          : b,
      );
      breakMinutes = Math.round(closedBreakSeconds(breaks) / 60);
    }

    const { data, error } = await supabase
      .from("staff_shifts")
      .update({ status: "active", break_minutes: breakMinutes })
      .eq("id", row.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    setState({ row: data as ShiftRow, breaks });
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
    const startedAt = new Date();
    const { data: brk } = await supabase
      .from("staff_shift_breaks")
      .insert({
        shift_id: row.id,
        user_id: state.userId,
        started_at: startedAt.toISOString(),
      })
      .select(BREAK_COLS)
      .single();
    const breaks = brk ? [...state.breaks, brk as ShiftBreak] : state.breaks;

    const worked = Math.floor(netWorkedSeconds(row, breaks, startedAt.getTime()) / 60);
    const { data, error } = await supabase
      .from("staff_shifts")
      .update({
        worked_minutes: worked,
        status: "paused",
      })
      .eq("id", row.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    setState({ row: data as ShiftRow, breaks });
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
    const endedAt = new Date();
    // Close a still-open break so the paused time counts in the daily total.
    let breaks = state.breaks;
    const open = openBreakOf(breaks);
    if (open) {
      const dur = Math.max(
        0,
        Math.floor((endedAt.getTime() - new Date(open.started_at).getTime()) / 1000),
      );
      await supabase
        .from("staff_shift_breaks")
        .update({ ended_at: endedAt.toISOString(), duration_seconds: dur })
        .eq("id", open.id);
      breaks = breaks.map((b) =>
        b.id === open.id ? { ...b, ended_at: endedAt.toISOString(), duration_seconds: dur } : b,
      );
    }
    const breakSec = closedBreakSeconds(breaks);
    const gross = row.clock_in
      ? Math.max(0, Math.floor((endedAt.getTime() - new Date(row.clock_in).getTime()) / 1000))
      : (row.worked_minutes ?? 0) * 60 + breakSec;
    const worked = Math.max(0, Math.floor((gross - breakSec) / 60));

    const { data, error } = await supabase
      .from("staff_shifts")
      .update({
        worked_minutes: worked,
        break_minutes: Math.round(breakSec / 60),
        clock_out: endedAt.toISOString(),
        status: "completed",
      })
      .eq("id", row.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    setState({ row: data as ShiftRow, breaks });
    clearWorkPause();
    toast.success(
      `Shift finished — ${Math.floor(worked / 60)}h${String(worked % 60).padStart(2, "0")} worked, ${Math.round(breakSec / 60)}m paused`,
    );
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
    if (!row) return 0;
    if (status === "completed") return (row.worked_minutes ?? 0) * 60;
    return netWorkedSeconds(row, state.breaks, now);
  }, [state.row, state.breaks, now, status]);

  /** Paused seconds so far today (open break counts live). */
  const breakSec = useMemo(() => {
    const open = openBreakOf(state.breaks);
    const live = open ? Math.max(0, Math.floor((now - new Date(open.started_at).getTime()) / 1000)) : 0;
    return closedBreakSeconds(state.breaks) + live;
  }, [state.breaks, now]);

  // A paused shift must always freeze the running job timer — and resuming the
  // shift must always release it, no matter where the pause came from.
  useEffect(() => {
    if (!userId || state.loading) return;
    void syncWorkPauseWithShift(status, userId);
  }, [status, userId, state.loading]);

  return {
    userId,
    row: state.row,
    breaks: state.breaks,
    breakSec,
    breakCount: state.breaks.length,
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