import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

/**
 * Workshop work-timer pause bridge.
 *
 * The appointment timer is derived from `appointments.work_started_at`. To
 * "pause" it we remember when the pause began and, on resume, push
 * `work_started_at` forward by the paused duration — so paused time never
 * counts as worked time. Pausing the shift pauses the running job, resuming
 * the shift resumes it automatically.
 */

const KEY = "wj.work.pausedAt";

let pausedAt: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

try {
  const raw = localStorage.getItem(KEY);
  if (raw) pausedAt = Number(raw) || null;
} catch {}

export const getWorkPausedAt = () => pausedAt;

const setPausedAt = (v: number | null) => {
  pausedAt = v;
  try {
    if (v) localStorage.setItem(KEY, String(v));
    else localStorage.removeItem(KEY);
  } catch {}
  emit();
};

async function runningAppointments(userId: string) {
  const { data } = await supabase
    .from("appointments")
    .select("id, work_started_at, work_paused_seconds")
    .eq("assigned_mechanic_id", userId)
    .eq("status", "in_progress")
    .not("work_started_at", "is", null);
  return (data ?? []) as {
    id: string;
    work_started_at: string;
    work_paused_seconds: number | null;
  }[];
}

/** Freeze the timer of every job currently running for this mechanic. */
export async function pauseWork(userId: string) {
  if (!userId || pausedAt) return;
  const at = Date.now();
  setPausedAt(at);
  // Persist the pause on every running job so it survives reloads/devices.
  const rows = await runningAppointments(userId);
  await Promise.all(
    rows.map((r) =>
      supabase
        .from("appointments")
        .update({ work_paused_at: new Date(at).toISOString() } as any)
        .eq("id", r.id),
    ),
  );
}

/** Resume: shift `work_started_at` forward by the paused duration. */
export async function resumeWork(userId: string) {
  const from = pausedAt;
  setPausedAt(null);
  if (!userId || !from) return;
  const delta = Math.max(0, Date.now() - from);
  const rows = await runningAppointments(userId);
  const resumedAt = new Date().toISOString();
  await Promise.all(
    rows.map((r) =>
      supabase
        .from("appointments")
        .update({
          work_started_at: new Date(new Date(r.work_started_at).getTime() + delta).toISOString(),
          work_paused_at: null,
          work_resumed_at: resumedAt,
          work_paused_seconds: (r.work_paused_seconds ?? 0) + Math.floor(delta / 1000),
        } as any)
        .eq("id", r.id),
    ),
  );
}

/** Drop the pause marker without compensating (shift finished / started fresh). */
export function clearWorkPause() {
  setPausedAt(null);
}

/**
 * Keep the work-timer pause in sync with the shift status, whatever the entry
 * point was (pill, tracker card, another device, page reload). A paused shift
 * always means a frozen job timer.
 */
export async function syncWorkPauseWithShift(
  status: "idle" | "active" | "paused" | "completed",
  userId: string,
) {
  if (status === "paused") {
    if (!pausedAt) setPausedAt(Date.now());
    return;
  }
  if (status === "active") {
    if (pausedAt) await resumeWork(userId);
    return;
  }
  if (pausedAt) setPausedAt(null);
}

/** Reference "now" for work timers — frozen while the shift is paused. */
export const workNow = () => pausedAt ?? Date.now();

export function useWorkPause() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { pausedAt, isPaused: pausedAt !== null, workNow };
}
