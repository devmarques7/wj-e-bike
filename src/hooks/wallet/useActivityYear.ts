import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** A single rider activity (service, revision, repair or purchase) with its point gain. */
export interface ActivityRecord {
  id: string;
  /** ISO date (YYYY-MM-DD) of the activity. */
  date: string;
  title: string;
  kind: "service" | "repair" | "revision" | "purchase";
  status: string;
  points: number;
  /** Free-text briefing captured at booking time. */
  briefing: string | null;
  durationMinutes: number | null;
  bikeName: string | null;
  extraCharge: number;
}

/** Aggregated activity of a single calendar day. */
export interface ActivityDay {
  date: string;
  records: ActivityRecord[];
  points: number;
  /** 0-3 intensity used by the dot grid. */
  level: 0 | 1 | 2 | 3;
}

function levelFor(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

function kindFor(name: string, status: string): ActivityRecord["kind"] {
  const n = name.toLowerCase();
  if (n.includes("repair") || n.includes("repar")) return "repair";
  if (n.includes("revis") || n.includes("mainten")) return "revision";
  if (status === "completed") return "service";
  return "service";
}

/**
 * Loads every rider activity of a given year and groups it per day, so the wallet can
 * render a GitHub-style dot calendar plus the folder history of each appointment.
 */
export function useActivityYear(userId: string | undefined, year: number) {
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_date, status, notes, duration_minutes, actual_duration_minutes, extra_charge_eur, service_types:service_type_id(name, name_en, reward_points)",
        )
        .eq("user_id", userId)
        .gte("scheduled_date", `${year}-01-01`)
        .lte("scheduled_date", `${year}-12-31`)
        .order("scheduled_date", { ascending: false });

      if (cancelled) return;
      const rows: ActivityRecord[] = (data ?? []).map((a: any) => {
        const title = a.service_types?.name_en || a.service_types?.name || "Service";
        return {
          id: a.id,
          date: a.scheduled_date,
          title,
          kind: kindFor(title, a.status),
          status: a.status,
          points: a.status === "completed" ? a.service_types?.reward_points ?? 0 : 0,
          briefing: a.notes ?? null,
          durationMinutes: a.actual_duration_minutes ?? a.duration_minutes ?? null,
          bikeName: null,
          extraCharge: Number(a.extra_charge_eur ?? 0),
        };
      });
      setRecords(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, year]);

  const daysMap = useMemo(() => {
    const map = new Map<string, ActivityDay>();
    for (const r of records) {
      const existing = map.get(r.date);
      if (existing) {
        existing.records.push(r);
        existing.points += r.points;
        existing.level = levelFor(existing.records.length);
      } else {
        map.set(r.date, { date: r.date, records: [r], points: r.points, level: 1 });
      }
    }
    return map;
  }, [records]);

  const totalPoints = useMemo(() => records.reduce((s, r) => s + r.points, 0), [records]);

  return { records, daysMap, totalPoints, loading };
}

/** Details of a single appointment: quality control, resolution and photos. */
export interface ActivityDetail {
  stages: {
    id: string;
    name: string;
    position: number;
    notes: string | null;
    durationSeconds: number | null;
    tasksDone: number;
    tasksTotal: number;
    photos: string[];
  }[];
  photos: string[];
  loading: boolean;
}

function extractPhotos(taskResults: any): string[] {
  const out: string[] = [];
  const visit = (v: any) => {
    if (!v) return;
    if (typeof v === "string") {
      if (/^https?:\/\//.test(v) && /(\.png|\.jpe?g|\.webp|photo|image)/i.test(v)) out.push(v);
      return;
    }
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(taskResults);
  return Array.from(new Set(out));
}

/** Loads the QC trail (stages, tasks, notes and photos) of one appointment. */
export function useActivityDetail(appointmentId: string | null): ActivityDetail {
  const [stages, setStages] = useState<ActivityDetail["stages"]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!appointmentId) {
      setStages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("appointment_qc_progress")
        .select("id, stage_name, stage_position, notes, duration_seconds, task_results")
        .eq("appointment_id", appointmentId)
        .order("stage_position", { ascending: true });

      if (cancelled) return;
      setStages(
        (data ?? []).map((s: any) => {
          const results = Array.isArray(s.task_results) ? s.task_results : [];
          return {
            id: s.id,
            name: s.stage_name || `Stage ${s.stage_position}`,
            position: s.stage_position,
            notes: s.notes ?? null,
            durationSeconds: s.duration_seconds ?? null,
            tasksDone: results.filter((r: any) => r?.done).length,
            tasksTotal: results.length,
            photos: extractPhotos(s.task_results),
          };
        }),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const photos = useMemo(() => stages.flatMap((s) => s.photos), [stages]);
  return { stages, photos, loading };
}