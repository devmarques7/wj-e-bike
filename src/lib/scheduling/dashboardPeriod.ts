import { localYmd } from "@/lib/scheduling/localDate";

export type DashboardPeriod =
  | "last30"
  | "last7"
  | "today"
  | "tomorrow"
  | "next_week"
  | "next_month";

export interface DateRange {
  from: string;
  to: string;
}

export const DASHBOARD_PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "last30", label: "Last 30 days" },
  { id: "last7", label: "Last 7 days" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "next_week", label: "Next week" },
  { id: "next_month", label: "Next month" },
];

const shift = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

/** Inclusive local-date range for a dashboard period. */
export function periodRange(period: DashboardPeriod, now: Date = new Date()): DateRange {
  switch (period) {
    case "last30":
      return { from: localYmd(shift(now, -29)), to: localYmd(now) };
    case "last7":
      return { from: localYmd(shift(now, -6)), to: localYmd(now) };
    case "tomorrow":
      return { from: localYmd(shift(now, 1)), to: localYmd(shift(now, 1)) };
    case "next_week":
      return { from: localYmd(now), to: localYmd(shift(now, 7)) };
    case "next_month":
      return { from: localYmd(now), to: localYmd(shift(now, 30)) };
    case "today":
    default:
      return { from: localYmd(now), to: localYmd(now) };
  }
}

export const periodLabel = (period: DashboardPeriod) =>
  DASHBOARD_PERIODS.find((p) => p.id === period)?.label ?? "Today";

/** True when the range covers past dates only (retrospective view). */
export const isPastPeriod = (period: DashboardPeriod) =>
  period === "last30" || period === "last7";
