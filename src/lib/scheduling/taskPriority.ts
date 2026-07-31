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
  assigned_mechanic_id?: string | null;
  priority?: string | null;
  priority_score?: number | null;
  isRequest?: boolean;
}

export const todayKey = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const isTaskOverdue = (a: TaskLike) =>
  !a.isRequest &&
  ["pending", "confirmed", "rescheduled"].includes(a.status) &&
  a.scheduled_date < todayKey();

/** Resolve the single bucket a row belongs to. */
export function taskBucket(a: TaskLike): TaskBucket {
  const s = a.status;
  if (s === "requested") return "requested";
  if (s === "in_progress") return "ongoing";
  if (s === "completed") return "completed";
  if (["canceled", "no_show"].includes(s)) return "canceled";
  if (isTaskOverdue(a)) return "overdue";
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
