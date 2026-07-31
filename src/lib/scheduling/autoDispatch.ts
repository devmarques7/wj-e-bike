/**
 * Global dispatch role.
 *
 * Evaluates the day's tasks (appointments) and spreads them across the
 * mechanics that are actually working, respecting their shift window, their
 * current bookings and a fair workload split. Anything that does not fit stays
 * unassigned so a mechanic can claim it manually.
 */
import { supabase } from "@/integrations/supabase/client";
import { todayKey } from "@/lib/scheduling/taskPriority";

export interface DispatchTask {
  id: string;
  scheduled_date: string;
  scheduled_start_time: string;
  duration_minutes: number | null;
  assigned_mechanic_id: string | null;
  status: string;
  priority?: string | null;
  priority_score?: number | null;
}

export interface MechanicWindow {
  staff_id: string;
  start: number; // minutes from midnight
  end: number;
  max_concurrent: number;
}

export interface Busy {
  staff_id: string;
  start: number;
  end: number;
}

export interface DispatchPlan {
  assignments: { appointmentId: string; mechanicId: string }[];
  unassignable: string[];
}

const ACTIVE = ["pending", "confirmed", "in_progress", "rescheduled"] as const;
const DEFAULT_DURATION = 45;
const BUFFER = 15;

export const toMinutes = (time: string) => {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Shift windows + already-booked intervals for one day. */
export async function loadDayCapacity(date: string) {
  const dow = new Date(`${date}T00:00:00`).getDay();

  const [schedRes, excRes, apptRes, profRes] = await Promise.all([
    supabase
      .from("staff_schedules")
      .select("staff_id, start_time, end_time, is_working, max_concurrent, valid_from, valid_until")
      .eq("day_of_week", dow)
      .eq("is_working", true)
      .lte("valid_from", date)
      .order("valid_from", { ascending: false }),
    supabase
      .from("staff_schedule_exceptions")
      .select("staff_id, is_working, start_time, end_time")
      .eq("exception_date", date),
    supabase
      .from("appointments")
      .select(
        "id, scheduled_date, scheduled_start_time, duration_minutes, assigned_mechanic_id, status, priority, priority_score",
      )
      .eq("scheduled_date", date)
      .in("status", ACTIVE),
    supabase.from("profiles").select("user_id, full_name"),
  ]);

  const exc = new Map(
    ((excRes.data ?? []) as any[]).map((e) => [e.staff_id, e]),
  );

  const windows: MechanicWindow[] = [];
  const seen = new Set<string>();
  for (const s of ((schedRes.data ?? []) as any[])) {
    if (seen.has(s.staff_id)) continue;
    if (s.valid_until && s.valid_until < date) continue;
    seen.add(s.staff_id);
    const e = exc.get(s.staff_id);
    if (e && e.is_working === false) continue;
    const start = toMinutes(e?.start_time ?? s.start_time ?? "09:00");
    const end = toMinutes(e?.end_time ?? s.end_time ?? "18:00");
    if (end <= start) continue;
    windows.push({
      staff_id: s.staff_id,
      start,
      end,
      max_concurrent: Math.max(1, s.max_concurrent ?? 1),
    });
  }

  const tasks = ((apptRes.data ?? []) as any[]) as DispatchTask[];
  const names = new Map(
    ((profRes.data ?? []) as any[]).map((p) => [p.user_id, p.full_name as string | null]),
  );

  return { windows, tasks, names };
}

const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;

/** Mechanics that can physically take this task, least loaded first. */
export function eligibleMechanics(
  task: DispatchTask,
  windows: MechanicWindow[],
  busy: Busy[],
  load: Map<string, number>,
): string[] {
  const start = toMinutes(task.scheduled_start_time);
  const end = start + (task.duration_minutes ?? DEFAULT_DURATION);
  return windows
    .filter((w) => start >= w.start && end <= w.end)
    .filter(
      (w) =>
        !busy.some(
          (b) => b.staff_id === w.staff_id && overlaps(start, end + BUFFER, b.start, b.end),
        ),
    )
    .sort(
      (a, b) =>
        (load.get(a.staff_id) ?? 0) - (load.get(b.staff_id) ?? 0) ||
        a.staff_id.localeCompare(b.staff_id),
    )
    .map((w) => w.staff_id);
}

/** Pure planner — decides who gets what without touching the database. */
export function planDispatch(
  tasks: DispatchTask[],
  windows: MechanicWindow[],
): DispatchPlan {
  const busy: Busy[] = [];
  const load = new Map<string, number>();
  for (const w of windows) load.set(w.staff_id, 0);

  for (const t of tasks) {
    if (!t.assigned_mechanic_id) continue;
    const s = toMinutes(t.scheduled_start_time);
    busy.push({
      staff_id: t.assigned_mechanic_id,
      start: s,
      end: s + (t.duration_minutes ?? DEFAULT_DURATION) + BUFFER,
    });
    load.set(t.assigned_mechanic_id, (load.get(t.assigned_mechanic_id) ?? 0) + 1);
  }

  const queue = tasks
    .filter((t) => !t.assigned_mechanic_id)
    .sort((a, b) => {
      const rank = (x: DispatchTask) =>
        x.priority === "emergency" ? 0 : x.priority === "vip" ? 1 : 2;
      return (
        rank(a) - rank(b) ||
        (b.priority_score ?? 0) - (a.priority_score ?? 0) ||
        a.scheduled_start_time.localeCompare(b.scheduled_start_time)
      );
    });

  const assignments: DispatchPlan["assignments"] = [];
  const unassignable: string[] = [];

  for (const t of queue) {
    const [pick] = eligibleMechanics(t, windows, busy, load);
    if (!pick) {
      unassignable.push(t.id);
      continue;
    }
    const s = toMinutes(t.scheduled_start_time);
    busy.push({
      staff_id: pick,
      start: s,
      end: s + (t.duration_minutes ?? DEFAULT_DURATION) + BUFFER,
    });
    load.set(pick, (load.get(pick) ?? 0) + 1);
    assignments.push({ appointmentId: t.id, mechanicId: pick });
  }

  return { assignments, unassignable };
}

/** Plan + persist. Returns how many jobs were distributed. */
export async function runAutoDispatch(date = todayKey()) {
  const { windows, tasks } = await loadDayCapacity(date);
  const plan = planDispatch(tasks, windows);

  for (const a of plan.assignments) {
    await supabase
      .from("appointments")
      .update({ assigned_mechanic_id: a.mechanicId })
      .eq("id", a.appointmentId);
  }

  return {
    assigned: plan.assignments.length,
    unassignable: plan.unassignable.length,
    mechanics: windows.length,
  };
}

/** Can this specific mechanic take the task right now? */
export async function canMechanicTake(task: DispatchTask, mechanicId: string, date: string) {
  const { windows, tasks } = await loadDayCapacity(date);
  const window = windows.find((w) => w.staff_id === mechanicId);
  if (!window) return { ok: false, reason: "off_shift" as const };
  const busy: Busy[] = tasks
    .filter((t) => t.assigned_mechanic_id === mechanicId && t.id !== task.id)
    .map((t) => {
      const s = toMinutes(t.scheduled_start_time);
      return {
        staff_id: mechanicId,
        start: s,
        end: s + (t.duration_minutes ?? DEFAULT_DURATION) + BUFFER,
      };
    });
  const eligible = eligibleMechanics(task, [window], busy, new Map());
  if (!eligible.length) {
    const start = toMinutes(task.scheduled_start_time);
    const end = start + (task.duration_minutes ?? DEFAULT_DURATION);
    return {
      ok: false,
      reason:
        start < window.start || end > window.end ? ("off_shift" as const) : ("busy" as const),
    };
  }
  return { ok: true as const, reason: null };
}
