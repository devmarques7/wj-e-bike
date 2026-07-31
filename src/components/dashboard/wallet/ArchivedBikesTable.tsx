import { useEffect, useState } from "react";
import { Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ArchivedBikeRecord = {
  id: string;
  bike_model: string | null;
  bike_serial: string | null;
  plan_name: string | null;
  reason: string | null;
  created_at: string;
};

/**
 * Separate register of cancelled bike registrations.
 * Records are kept in the database (soft delete) so history stays auditable.
 */
export default function ArchivedBikesTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ArchivedBikeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("bike_archive_records")
        .select("id, bike_model, bike_serial, plan_name, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (cancelled) return;
      setRows((data as ArchivedBikeRecord[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, refreshKey]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Archived bike registrations</h3>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 font-medium">Bike</th>
              <th className="pb-2 font-medium">Serial</th>
              <th className="pb-2 font-medium">Plan</th>
              <th className="pb-2 font-medium">Reason</th>
              <th className="pb-2 font-medium text-right">Cancelled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="py-2.5 pr-3 text-foreground">{r.bike_model || "—"}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{r.bike_serial || "—"}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{r.plan_name || "—"}</td>
                <td className="py-2.5 pr-3 text-muted-foreground max-w-[220px] truncate">{r.reason || "—"}</td>
                <td className="py-2.5 text-right text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        These bikes were removed from your wallet but their service history stays stored for future reactivation.
      </p>
    </div>
  );
}
