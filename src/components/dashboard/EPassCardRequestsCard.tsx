import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatCardNumber } from "@/hooks/useEPassCards";

interface RequestRow {
  id: string;
  user_id: string;
  bike_serial: string | null;
  bike_model: string | null;
  card_number: string;
  tier: string;
  status: string;
  created_at: string;
  holder?: string;
}

export default function EPassCardRequestsCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("epass_card_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const list = (data ?? []) as RequestRow[];
    if (list.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", list.map((r) => r.user_id));
      list.forEach((r) => {
        const p = profiles?.find((x: any) => x.user_id === r.user_id) as any;
        r.holder = p?.full_name || p?.email || "Member";
      });
    }
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const channel = supabase
      .channel("epass_card_requests:admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "epass_card_requests" }, () => fetchRows())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRows]);

  const review = async (row: RequestRow, status: "approved" | "rejected") => {
    setBusy(row.id);
    const { error } = await supabase
      .from("epass_card_requests")
      .update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusy(null);
    if (error) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: status === "approved" ? "Card approved" : "Request rejected",
      description: `${row.holder} has been notified.`,
    });
    fetchRows();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">E-Pass card requests</h3>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} pending</span>
      </div>

      {loading ? (
        <div className="h-16 rounded-xl bg-muted/30 animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No pending card requests.</p>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/30 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{r.holder}</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {formatCardNumber(r.card_number)} · {r.bike_serial || "no serial"}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" disabled={busy === r.id} onClick={() => review(r, "approved")}>
                {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={busy === r.id} onClick={() => review(r, "rejected")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
