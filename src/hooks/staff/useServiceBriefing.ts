import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HealthMetric } from "@/hooks/garage/useGarageBike";

export interface BriefingAppointment {
  id: string;
  date: string;
  startTime: string;
  status: string;
  serviceName: string | null;
  notes: string | null;
  isCovered: boolean;
  extraCharge: number | null;
  isRequest?: boolean;
}

export interface ServiceBriefing {
  loading: boolean;
  /** Does the rider already have an upcoming appointment / request? */
  hasAppointment: boolean;
  next: BriefingAppointment | null;
  last: BriefingAppointment | null;
  /** Short summary of the reported problem (from the appointment notes). */
  problem: string | null;
  coverage: "covered" | "extra" | "unknown";
  extraCharge: number | null;
  /** Components that need a look, worst first. */
  partsToReview: { label: string; value: number; detail: string }[];
  /** Days until the standard revision is due (negative = overdue). */
  daysToRevision: number | null;
  /** Recommended booking window when there is no appointment yet. */
  scheduleWithin: string | null;
  urgency: "overdue" | "soon" | "planned" | "none";
  /** Markdown block used to brief the staff member and the AI. */
  markdown: string;
}

const PART_THRESHOLD = 65;

function fmtDate(date: string, time?: string | null) {
  const d = new Date(`${date}T${(time ?? "12:00").slice(0, 5)}:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Workshop briefing for the E-Pass scan screen.
 * Answers, without the staff member asking: does this rider have an appointment,
 * what is the reported problem, is it covered by the plan, which parts need a
 * review and — when nothing is booked — how soon it should be scheduled.
 */
export function useServiceBriefing(params: {
  ownerUserId?: string | null;
  bikeId?: string | null;
  bikeModel?: string | null;
  ownerName?: string | null;
  planName?: string | null;
  metrics: HealthMetric[];
  daysToRevision: number | null;
  enabled?: boolean;
}): ServiceBriefing {
  const {
    ownerUserId,
    bikeId,
    bikeModel,
    ownerName,
    planName,
    metrics,
    daysToRevision,
    enabled = true,
  } = params;

  const [rows, setRows] = useState<BriefingAppointment[]>([]);
  const [requests, setRequests] = useState<BriefingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !ownerUserId) {
      setRows([]);
      setRequests([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [apptRes, waitRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, scheduled_date, scheduled_start_time, status, notes, is_covered_by_plan, extra_charge_eur, bike_id, service_types(name)",
          )
          .eq("user_id", ownerUserId)
          .order("scheduled_date", { ascending: false })
          .limit(30),
        supabase
          .from("appointment_waitlist")
          .select("id, preferred_date_from, status, bike_id, service_types(name)")
          .eq("user_id", ownerUserId)
          .eq("status", "waiting")
          .limit(10),
      ]);

      if (cancelled) return;

      const scoped = ((apptRes.data ?? []) as any[]).filter(
        (a) => !bikeId || !a.bike_id || a.bike_id === bikeId,
      );
      setRows(
        scoped.map((a) => ({
          id: a.id,
          date: a.scheduled_date,
          startTime: String(a.scheduled_start_time ?? "").slice(0, 5),
          status: a.status,
          serviceName: a.service_types?.name ?? null,
          notes: a.notes ?? null,
          isCovered: Boolean(a.is_covered_by_plan),
          extraCharge: a.extra_charge_eur ?? null,
        })),
      );
      setRequests(
        ((waitRes.data ?? []) as any[])
          .filter((w) => !bikeId || !w.bike_id || w.bike_id === bikeId)
          .map((w) => ({
            id: w.id,
            date: w.preferred_date_from,
            startTime: "",
            status: "requested",
            serviceName: w.service_types?.name ?? null,
            notes: null,
            isCovered: false,
            extraCharge: null,
            isRequest: true,
          })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, ownerUserId, bikeId]);

  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = rows
      .filter((r) => r.date >= today && !["canceled", "completed", "no_show"].includes(r.status))
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = upcoming[0] ?? requests[0] ?? null;
    const last =
      rows
        .filter((r) => r.status === "completed")
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

    const problem = next?.notes?.trim() || null;
    const coverage: ServiceBriefing["coverage"] = !next
      ? "unknown"
      : next.isCovered
        ? "covered"
        : next.extraCharge && next.extraCharge > 0
          ? "extra"
          : "unknown";

    const partsToReview = [...metrics]
      .filter((m) => m.value < PART_THRESHOLD)
      .sort((a, b) => a.value - b.value)
      .map((m) => ({ label: m.label, value: Math.round(m.value), detail: m.detail ?? "" }));

    const urgency: ServiceBriefing["urgency"] = next
      ? "planned"
      : daysToRevision === null
        ? "none"
        : daysToRevision < 0
          ? "overdue"
          : daysToRevision <= 21
            ? "soon"
            : "none";

    const scheduleWithin = next
      ? null
      : daysToRevision === null
        ? "No revision date on file — book a baseline check."
        : daysToRevision < 0
          ? `Overdue by ${Math.abs(daysToRevision)} days — book today.`
          : daysToRevision <= 21
            ? `Due in ${daysToRevision} days — book within this week.`
            : `Due in ${daysToRevision} days — no action needed yet.`;

    const markdown = [
      `**Workshop briefing** — ${bikeModel ?? "bike"}${ownerName ? ` · ${ownerName}` : ""}${planName ? ` · ${planName} plan` : ""}`,
      "",
      next
        ? `**Appointment:** yes — ${next.isRequest ? "pending request" : next.status.replace("_", " ")} on ${fmtDate(next.date, next.startTime)}${next.startTime ? ` at ${next.startTime}` : ""}${next.serviceName ? ` (${next.serviceName})` : ""}.`
        : "**Appointment:** no — nothing booked for this bike.",
      next
        ? `**Reported problem:** ${problem ? problem : "no description attached to the booking."}`
        : `**When to schedule:** ${scheduleWithin}`,
      next
        ? `**Coverage:** ${
            coverage === "covered"
              ? "included in the membership plan."
              : coverage === "extra"
                ? `extra payment required — €${Number(next.extraCharge).toFixed(2)}.`
                : "not flagged yet — confirm coverage before starting."
          }`
        : `**Coverage:** a standard revision is included in the ${planName ?? "current"} plan; extra repairs are charged separately.`,
      partsToReview.length
        ? `**Parts to review:** ${partsToReview.map((p) => `${p.label} (${p.value}%)`).join(", ")}.`
        : "**Parts to review:** all components above 65% — visual inspection only.",
      last ? `**Last service:** ${fmtDate(last.date)}${last.serviceName ? ` · ${last.serviceName}` : ""}.` : "**Last service:** no completed service on record.",
    ].join("\n");

    return {
      loading,
      hasAppointment: Boolean(next),
      next,
      last,
      problem,
      coverage,
      extraCharge: next?.extraCharge ?? null,
      partsToReview,
      daysToRevision,
      scheduleWithin,
      urgency,
      markdown,
    };
  }, [rows, requests, metrics, daysToRevision, loading, bikeModel, ownerName, planName]);
}