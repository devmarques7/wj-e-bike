/**
 * Global appointment status model.
 *
 * Single source of truth for every status an appointment (or a scheduling
 * request) can have across Admin, Staff and Customer surfaces: colour,
 * translation key, whether it is still open work and which transitions a
 * manager may apply from the tables.
 */

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "canceled"
  | "no_show"
  | "rescheduled";

/** Virtual statuses that only exist in the UI layer. */
export type VirtualStatus = "requested" | "overdue";

export type AnyStatus = AppointmentStatus | VirtualStatus;

export interface StatusMeta {
  /** Tailwind classes for the status dot. */
  dot: string;
  /** i18n key with the human label. */
  labelKey: string;
  /** Still actionable work (not archived). */
  open: boolean;
  /** Needs a manager decision before it becomes real work. */
  needsApproval?: boolean;
  /** Statuses a manager can move this one to. */
  next: AppointmentStatus[];
}

export const STATUS_MODEL: Record<AnyStatus, StatusMeta> = {
  requested: {
    dot: "bg-sky-400",
    labelKey: "workshop.status.requested",
    open: true,
    needsApproval: true,
    next: ["confirmed", "canceled"],
  },
  pending: {
    dot: "bg-amber-400",
    labelKey: "workshop.status.pending",
    open: true,
    next: ["confirmed", "in_progress", "rescheduled", "canceled", "no_show"],
  },
  confirmed: {
    dot: "bg-wj-green/70",
    labelKey: "workshop.status.confirmed",
    open: true,
    next: ["in_progress", "rescheduled", "canceled", "no_show"],
  },
  in_progress: {
    dot: "bg-wj-green animate-pulse",
    labelKey: "workshop.status.in_progress",
    open: true,
    next: ["completed", "canceled"],
  },
  rescheduled: {
    dot: "bg-amber-400",
    labelKey: "workshop.status.rescheduled",
    open: true,
    next: ["confirmed", "canceled"],
  },
  overdue: {
    dot: "bg-orange-500",
    labelKey: "workshop.status.overdue",
    open: true,
    next: ["confirmed", "in_progress", "rescheduled", "canceled", "no_show"],
  },
  completed: {
    dot: "bg-wj-green",
    labelKey: "workshop.status.completed",
    open: false,
    next: [],
  },
  canceled: {
    dot: "bg-red-500",
    labelKey: "workshop.status.canceled",
    open: false,
    next: ["pending"],
  },
  no_show: {
    dot: "bg-red-500/70",
    labelKey: "workshop.status.no_show",
    open: false,
    next: ["pending"],
  },
};

export const statusMeta = (status: string): StatusMeta =>
  STATUS_MODEL[status as AnyStatus] ?? {
    dot: "bg-muted-foreground/60",
    labelKey: `workshop.status.${status}`,
    open: true,
    next: [],
  };

export const statusDot = (status: string) => statusMeta(status).dot;

export const isOpenStatus = (status: string) => statusMeta(status).open;

export const nextStatuses = (status: string) => statusMeta(status).next;
