import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  awardAppointmentPoints,
  sumPoints,
  type RewardLedgerEntry,
} from "@/lib/rewards/rewards";

interface RewardsValue {
  entries: RewardLedgerEntry[];
  total: number;
  loading: boolean;
  /** Points earned on a given bike (E-Pass card). */
  pointsForBike: (bikeId?: string | null) => number;
  entriesForBike: (bikeId?: string | null) => RewardLedgerEntry[];
  /** Awards + refreshes. Idempotent per appointment. */
  award: (appointmentId: string, conditionScore?: number | null) => Promise<number>;
  refetch: () => Promise<void>;
}

const RewardsContext = createContext<RewardsValue | null>(null);

/**
 * Global, reusable rewards context: every surface (E-Pass, wallet, garage,
 * workshop) reads the same ledger and awards points through the same path.
 */
export function RewardsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("reward_points_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setEntries((data as unknown as RewardLedgerEntry[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates when the workshop closes a job.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`rewards:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reward_points_ledger", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const value = useMemo<RewardsValue>(() => {
    const forBike = (bikeId?: string | null) =>
      bikeId ? entries.filter((e) => e.bike_id === bikeId) : entries;
    return {
      entries,
      total: sumPoints(entries),
      loading,
      entriesForBike: forBike,
      pointsForBike: (bikeId) => sumPoints(forBike(bikeId)),
      award: async (appointmentId, conditionScore) => {
        const { points } = await awardAppointmentPoints(appointmentId, conditionScore);
        await load();
        return points;
      },
      refetch: load,
    };
  }, [entries, loading, load]);

  return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
}

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx) {
    throw new Error("useRewards must be used inside <RewardsProvider>");
  }
  return ctx;
}