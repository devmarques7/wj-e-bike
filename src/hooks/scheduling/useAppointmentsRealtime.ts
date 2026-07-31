import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global appointments realtime bus.
 *
 * One single Supabase channel is shared by every surface in the app (customer
 * dashboard table, staff schedule, admin command center, KPI cards…). Whenever
 * an appointment — or its quality-control progress — changes anywhere, every
 * registered listener is notified, so all roles see the same data instantly
 * without each screen opening its own socket.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function broadcast() {
  // Small debounce: a single booking touches several rows/tables.
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error("[appointments-realtime] listener failed", e);
      }
    });
  }, 150);
}

function ensureChannel() {
  if (channel) return;
  channel = supabase
    .channel("appointments-global")
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, broadcast)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "appointment_qc_progress" },
      broadcast,
    )
    .subscribe();
}

function teardown() {
  if (listeners.size === 0 && channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

/** Runs `onChange` whenever any appointment changes (any role, any date). */
export function useAppointmentsRealtime(onChange: () => void, enabled = true) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const listener = () => cb.current();
    listeners.add(listener);
    ensureChannel();
    return () => {
      listeners.delete(listener);
      teardown();
    };
  }, [enabled]);
}

/**
 * Convenience variant for hooks whose loader lives inside a `useEffect`:
 * returns a counter that increments on every appointment change.
 */
export function useAppointmentsRealtimeTick(enabled = true) {
  const [tick, setTick] = useState(0);
  useAppointmentsRealtime(() => setTick((t) => t + 1), enabled);
  return tick;
}

export default useAppointmentsRealtime;
