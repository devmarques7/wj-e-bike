/**
 * Global task-priority rules shared by every reusable appointments table.
 *
 * The workshop principle: finish what is already booked, then triage what was
 * requested, watch what is running, recover what is late and only then look at
 * the archive (canceled / completed).
 */

export type TaskBucket =
  | "pending"
  | "requested"
  | "ongoing"
  | "overdue"
  | "canceled"
  | "completed";

/** Filters exposed in the UI. "unassigned" is a cross-cutting view. */
export type TaskFilter = TaskBucket | "unassigned";

/** Lower number = shown first. */
export const BUCKET_ORDER: Record<TaskBucket, number> = {
  pending: 0,
  requested: 1,
  ongoing: 2,
  overdue: 3,
  canceled: 4,
  completed: 5,
};

export const TASK_FILTERS: TaskFilter[] = [
  "pending",
  "requested",
  "ongoing",
  "unassigned",
  "overdue",
  "canceled",
  "completed",
];

export interface TaskLike {
  status: string;
  scheduled_date: string;
  scheduled_start_time: string;
  duration_minutes?: number | null;
  assigned_mechanic_id?: string | null;
  priority?: string | null;
  priority_score?: number | null;
  isRequest?: boolean;
}

export const todayKey = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Grace period (minutes) after the slot end before a task is called late. */
export const OVERDUE_GRACE_MIN = 30;
const DEFAULT_DURATION_MIN = 45;

/** Local Date for the moment a task should have been finished. */
export function taskEndsAt(a: TaskLike): Date {
  const [h, m] = (a.scheduled_start_time ?? "00:00").slice(0, 5).split(":").map(Number);
  const d = new Date(`${a.scheduled_date}T00:00:00`);
  d.setMinutes(
    (h || 0) * 60 + (m || 0) + (a.duration_minutes ?? DEFAULT_DURATION_MIN),
  );
  return d;
}

/**
 * A task is overdue when its scheduled window (plus grace) has passed and it
 * was never started or closed — including requests for a time already gone.
 */
export const isTaskOverdue = (a: TaskLike, now: Date = new Date()) => {
  const openStatuses = a.isRequest
    ? ["requested", "pending", "waiting"]
    : ["pending", "confirmed", "rescheduled"];
  if (!openStatuses.includes(a.status)) return false;
  return taskEndsAt(a).getTime() + OVERDUE_GRACE_MIN * 60000 < now.getTime();
};

/** Overdue for longer than a full day → the reaper cancels it. */
export const isStaleOverdue = (a: TaskLike, now: Date = new Date()) =>
  isTaskOverdue(a, now) &&
  taskEndsAt(a).getTime() + 24 * 60 * 60000 < now.getTime();

/** Resolve the single bucket a row belongs to. */
export function taskBucket(a: TaskLike): TaskBucket {
  const s = a.status;
  if (s === "in_progress") return "ongoing";
  if (s === "completed") return "completed";
  if (["canceled", "no_show"].includes(s)) return "canceled";
  if (isTaskOverdue(a)) return "overdue";
  if (s === "requested") return "requested";
  return "pending";
}

export function matchesFilter(a: TaskLike, filter: TaskFilter): boolean {
  if (filter === "unassigned") {
    // Only actionable work can be picked up — never archive rows.
    const b = taskBucket(a);
    return !a.assigned_mechanic_id && ["pending", "requested", "overdue"].includes(b);
  }
  return taskBucket(a) === filter;
}

/** Today-first scope: everything that must be handled today (plus late work). */
export function isTodayScope(a: TaskLike): boolean {
  const b = taskBucket(a);
  if (b === "overdue") return true;
  return a.scheduled_date <= todayKey();
}

/**
 * Canonical ordering: bucket priority → emergency/VIP → priority score → time.
 */
export function compareTasks(a: TaskLike, b: TaskLike): number {
  const ba = BUCKET_ORDER[taskBucket(a)];
  const bb = BUCKET_ORDER[taskBucket(b)];
  if (ba !== bb) return ba - bb;
  const rank = (x: TaskLike) => (x.priority === "emergency" ? 0 : x.priority === "vip" ? 1 : 2);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  const sa = b.priority_score ?? 0;
  const sb = a.priority_score ?? 0;
  if (sa !== sb) return sa - sb;
  const d = a.scheduled_date.localeCompare(b.scheduled_date);
  if (d !== 0) return d;
  return a.scheduled_start_time.localeCompare(b.scheduled_start_time);
}
