import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

export type SystemStatusTone = "info" | "success" | "warning" | "urgent";

export type SystemStatus = {
  id: string;
  label: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: SystemStatusTone;
  href?: string;
  onClick?: () => void;
  /** Absolute epoch ms — when set, item auto-dismisses at this time. */
  expiresAt?: number;
  /** Absolute epoch ms — when set, label shows a live countdown (e.g. "42m"). */
  countdownTo?: number;
  /** ms since epoch of creation (auto). */
  createdAt: number;
};

type PushInput = Omit<SystemStatus, "id" | "createdAt"> & {
  id?: string;
  /** Convenience — sets expiresAt = now + ttlMs. */
  ttlMs?: number;
};

type Ctx = {
  statuses: SystemStatus[];
  pushStatus: (s: PushInput) => string;
  updateStatus: (id: string, patch: Partial<SystemStatus>) => void;
  dismissStatus: (id: string) => void;
  clearStatuses: () => void;
};

const SystemStatusContext = createContext<Ctx | null>(null);

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<SystemStatus[]>([]);

  const pushStatus = useCallback((input: PushInput) => {
    const id =
      input.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const item: SystemStatus = {
      tone: "info",
      ...input,
      id,
      createdAt: Date.now(),
      expiresAt:
        input.expiresAt ??
        (input.ttlMs ? Date.now() + input.ttlMs : undefined),
    };
    setStatuses((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return [...filtered, item];
    });
    return id;
  }, []);

  const updateStatus = useCallback(
    (id: string, patch: Partial<SystemStatus>) => {
      setStatuses((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const dismissStatus = useCallback((id: string) => {
    setStatuses((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearStatuses = useCallback(() => setStatuses([]), []);

  // Auto-expire tick
  useEffect(() => {
    if (!statuses.some((s) => s.expiresAt)) return;
    const t = setInterval(() => {
      const now = Date.now();
      setStatuses((prev) => prev.filter((s) => !s.expiresAt || s.expiresAt > now));
    }, 1000);
    return () => clearInterval(t);
  }, [statuses]);

  const value = useMemo(
    () => ({ statuses, pushStatus, updateStatus, dismissStatus, clearStatuses }),
    [statuses, pushStatus, updateStatus, dismissStatus, clearStatuses],
  );

  return (
    <SystemStatusContext.Provider value={value}>
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  const ctx = useContext(SystemStatusContext);
  if (!ctx) {
    // Safe fallback for components rendered outside provider (SSR/tests)
    const noop = () => "";
    return {
      statuses: [] as SystemStatus[],
      pushStatus: noop as unknown as Ctx["pushStatus"],
      updateStatus: (() => {}) as Ctx["updateStatus"],
      dismissStatus: (() => {}) as Ctx["dismissStatus"],
      clearStatuses: () => {},
    };
  }
  return ctx;
}

/** Formats an absolute epoch ms as a short countdown like "2h 05m", "42m", "18s". */
export function formatCountdown(target: number, now = Date.now()) {
  const diff = Math.max(0, target - now);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm.toString().padStart(2, "0")}m`;
}