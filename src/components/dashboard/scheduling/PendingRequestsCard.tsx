import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, UserPlus, Wand2, X, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { statusDot } from "@/lib/scheduling/statusModel";
import {
  approveRequest,
  autoAssignRequests,
  listSlots,
  rejectRequest,
  type Slot,
  type WaitlistRequest,
} from "@/lib/scheduling/requestApproval";
import { todayKey } from "@/lib/scheduling/taskPriority";
import type { Mechanic } from "@/hooks/scheduling/useSchedulingData";

interface Props {
  mechanics?: Mechanic[];
  /** Called after any approval/rejection so the tables refresh. */
  onChanged?: () => void;
}

/**
 * Highlighted approvals inbox: every scheduling request a manager still has to
 * accept. Approving books the request as a confirmed appointment, either on a
 * hand-picked slot or on the earliest opening (auto-assign).
 */
export default function PendingRequestsCard({ mechanics = [], onChanged }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<WaitlistRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [assignTarget, setAssignTarget] = useState<WaitlistRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("appointment_waitlist")
      .select(
        "id, user_id, service_type_id, subscription_id, bike_id, preferred_date_from, preferred_time_from, status, created_at",
      )
      .eq("status", "waiting")
      .order("created_at", { ascending: true });
    const list = (data ?? []) as any[];
    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    const svcIds = [...new Set(list.map((r) => r.service_type_id).filter(Boolean))];
    const [profRes, svcRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      svcIds.length
        ? supabase.from("service_types").select("id, name, duration_minutes").in("id", svcIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map(((profRes.data ?? []) as any[]).map((p) => [p.user_id, p]));
    const svcMap = new Map(((svcRes.data ?? []) as any[]).map((s) => [s.id, s]));
    setRows(
      list.map((r) => {
        const p = profMap.get(r.user_id);
        const s = svcMap.get(r.service_type_id);
        return {
          ...r,
          customer_name: p?.full_name ?? p?.email ?? null,
          service_name: s?.name ?? null,
          duration_minutes: s?.duration_minutes ?? null,
        } as WaitlistRequest;
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("waitlist-approvals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_waitlist" },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const refresh = () => {
    void load();
    onChanged?.();
  };

  const handleApprove = async (req: WaitlistRequest, slot?: Slot | null) => {
    setBusy(req.id);
    try {
      const res = await approveRequest(req, slot);
      if (!res.ok) {
        toast.error(res.error ?? t("workshop.requests.failed"));
        return;
      }
      toast.success(
        t("workshop.requests.approved", {
          date: res.slot!.date,
          time: res.slot!.start_time,
          mechanic: res.slot!.mechanic_name ?? "—",
        }),
      );
      setAssignTarget(null);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleAutoAll = async () => {
    setBulk(true);
    try {
      const res = await autoAssignRequests(rows);
      if (res.assigned) toast.success(t("workshop.requests.bulk_ok", { n: res.assigned }));
      if (res.failures.length)
        toast.error(t("workshop.requests.bulk_fail", { n: res.failures.length }));
      refresh();
    } finally {
      setBulk(false);
    }
  };

  const handleReject = async (req: WaitlistRequest) => {
    setBusy(req.id);
    try {
      await rejectRequest(req.id);
      toast.success(t("workshop.requests.rejected"));
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? t("workshop.requests.failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-sky-400/30 bg-sky-400/[0.04] backdrop-blur-md overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${statusDot("requested")}`} />
            <h3 className="text-sm font-medium text-foreground">
              {t("workshop.requests.title")}
            </h3>
            <Badge className="bg-sky-400/15 text-sky-300 border border-sky-400/30 text-[10px] font-normal">
              {rows.length}
            </Badge>
          </div>
          <Button
            size="sm"
            className="h-8 text-[11px] bg-wj-green hover:bg-wj-green/90 text-black gap-1.5"
            disabled={bulk || rows.length === 0}
            onClick={handleAutoAll}
          >
            {bulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {t("workshop.requests.auto_all")}
          </Button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("workshop.appts.loading")}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-5 w-5 opacity-60" />
            {t("workshop.requests.empty")}
          </div>
        ) : (
          <ul className="divide-y divide-border/20">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-sky-400/[0.05] transition-colors"
              >
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm text-foreground">{r.customer_name ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.service_name ?? "—"}
                    {r.duration_minutes ? ` · ${r.duration_minutes} ${t("workshop.cols.min")}` : ""}
                  </p>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums min-w-[120px]">
                  {r.preferred_date_from}
                  {r.preferred_time_from ? ` · ${r.preferred_time_from.slice(0, 5)}` : ""}
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px] border-border/40 gap-1.5"
                    disabled={busy === r.id}
                    onClick={() => setAssignTarget(r)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t("workshop.requests.assign")}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-[11px] bg-wj-green hover:bg-wj-green/90 text-black gap-1.5"
                    disabled={busy === r.id}
                    onClick={() => handleApprove(r)}
                  >
                    {busy === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {t("workshop.requests.approve")}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                    disabled={busy === r.id}
                    onClick={() => handleReject(r)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <AssignDialog
        req={assignTarget}
        mechanics={mechanics}
        onClose={() => setAssignTarget(null)}
        onConfirm={(slot) => assignTarget && handleApprove(assignTarget, slot)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function AssignDialog({
  req,
  mechanics,
  onClose,
  onConfirm,
}: {
  req: WaitlistRequest | null;
  mechanics: Mechanic[];
  onClose: () => void;
  onConfirm: (slot: Slot) => void;
}) {
  const { t } = useTranslation();
  const [mechanic, setMechanic] = useState<string>("any");
  const [date, setDate] = useState<string>(todayKey());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotKey, setSlotKey] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!req) return;
    setMechanic("any");
    setDate(req.preferred_date_from > todayKey() ? req.preferred_date_from : todayKey());
    setSlotKey("");
  }, [req]);

  useEffect(() => {
    if (!req?.service_type_id) return;
    let cancelled = false;
    setLoading(true);
    listSlots(req.service_type_id, date, mechanic === "any" ? null : mechanic)
      .then((s) => {
        if (!cancelled) {
          setSlots(s);
          setSlotKey("");
        }
      })
      .catch((e) => toast.error(e?.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [req, date, mechanic]);

  const selected = useMemo(
    () => slots.find((s) => `${s.start_time}|${s.mechanic_id}` === slotKey) ?? null,
    [slots, slotKey],
  );

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-light">
            {t("workshop.requests.assign_title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {req?.customer_name} · {req?.service_name}
          </div>
          <Select value={mechanic} onValueChange={setMechanic}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any" className="text-xs">
                {t("workshop.requests.any_mechanic")}
              </SelectItem>
              {mechanics.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                  {m.full_name ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            min={todayKey()}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-xs"
          />
          <Select value={slotKey} onValueChange={setSlotKey} disabled={loading || !slots.length}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue
                placeholder={
                  loading
                    ? t("workshop.appts.loading")
                    : slots.length
                      ? t("workshop.requests.pick_slot")
                      : t("workshop.requests.no_slots")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {slots.map((s) => (
                <SelectItem
                  key={`${s.start_time}|${s.mechanic_id}`}
                  value={`${s.start_time}|${s.mechanic_id}`}
                  className="text-xs"
                >
                  {s.start_time} – {s.end_time} · {s.mechanic_name ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-wj-green hover:bg-wj-green/90 text-black"
              disabled={!selected}
              onClick={() => selected && onConfirm(selected)}
            >
              {t("workshop.requests.approve")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
