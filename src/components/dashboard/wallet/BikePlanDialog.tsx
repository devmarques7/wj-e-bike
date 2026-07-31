import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CreditCard, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { PlanOption } from "@/hooks/plans/useBikeSubscriptions";

const intervalLabel: Record<string, string> = {
  monthly: "per month",
  quarterly: "per quarter",
  yearly: "per year",
  lifetime: "one-time",
};

interface BikePlanDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bikeId: string | null;
  bikeName: string;
  plans: PlanOption[];
  currentPlan: PlanOption | null;
  pendingPlan: PlanOption | null;
  onRequestChange: (bikeId: string, planVersionId: string) => Promise<void>;
  onCancelPending?: (bikeId: string) => Promise<void>;
}

/**
 * Per-bike membership flow: choose a plan for this single E-Pass card, review
 * the change and stop right before payment (integration pending).
 */
export default function BikePlanDialog({
  open,
  onOpenChange,
  bikeId,
  bikeName,
  plans,
  currentPlan,
  pendingPlan,
  onRequestChange,
  onCancelPending,
}: BikePlanDialogProps) {
  const [step, setStep] = useState<"select" | "review" | "done">("select");
  const [selected, setSelected] = useState<PlanOption | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("select");
      setSelected(null);
    }
  }, [open, bikeId]);

  const vat = useMemo(() => (selected ? selected.price * 0.21 : 0), [selected]);
  const isFree = (selected?.price ?? 0) <= 0;

  const confirm = async () => {
    if (!bikeId || !selected) return;
    setSaving(true);
    try {
      await onRequestChange(bikeId, selected.planVersionId);
      setStep("done");
      toast.success(
        isFree ? `${selected.name} activated for ${bikeName}` : "Plan reserved for this bike",
        {
          description: isFree
            ? "This E-Pass card now runs on its own plan."
            : "Payment will be collected as soon as the checkout integration is live.",
        },
      );
    } catch (e: any) {
      toast.error("Could not update this card", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[86vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-light text-xl">
            {step === "done" ? "Membership updated" : "Membership for this bike"}
          </DialogTitle>
          <DialogDescription>
            {step === "done"
              ? "Each E-Pass card carries its own plan."
              : `Each card can run a different plan · ${bikeName}`}
          </DialogDescription>
        </DialogHeader>

        {/* Pending banner */}
        {pendingPlan && step === "select" && (
          <div className="rounded-2xl border border-wj-green/40 bg-wj-green/5 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Awaiting payment</p>
              <p className="text-sm text-foreground truncate">{pendingPlan.name}</p>
            </div>
            {onCancelPending && bikeId && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-xs"
                onClick={async () => {
                  await onCancelPending(bikeId);
                  toast.success("Pending upgrade cancelled");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        )}

        {step === "select" && (
          <div className="space-y-2">
            {plans.map((p) => {
              const isCurrent = currentPlan?.planVersionId === p.planVersionId;
              const active = selected?.planVersionId === p.planVersionId;
              return (
                <button
                  key={p.planVersionId}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    active
                      ? "border-wj-green bg-wj-green/5 shadow-[0_0_0_1px_hsl(var(--wj-green,142_92%_28%)/0.35)]"
                      : "border-border/50 bg-card hover:border-border"
                  } ${isCurrent ? "opacity-60 cursor-default" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border/60 rounded-full px-2 py-0.5">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {p.description ||
                          `${p.entitlements.services_per_year < 0 ? "Unlimited" : p.entitlements.services_per_year} services / year`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-foreground">
                        {p.price > 0 ? `€${p.price.toFixed(2)}` : "Free"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.price > 0 ? intervalLabel[p.interval] ?? p.interval : "included"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            <Button
              className="rounded-full w-full mt-2"
              disabled={!selected}
              onClick={() => setStep("review")}
            >
              Continue
            </Button>
          </div>
        )}

        {step === "review" && selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{selected.name} · {bikeName}</span>
                <span className="text-foreground">€{selected.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT (21%)</span>
                <span className="text-foreground">€{vat.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total {intervalLabel[selected.interval] ?? selected.interval}</span>
                <span className="text-wj-green">€{(selected.price + vat).toFixed(2)}</span>
              </div>
              {selected.trialDays > 0 && (
                <p className="text-xs text-wj-green">First {selected.trialDays} days free.</p>
              )}
            </div>

            <div className="rounded-2xl border border-dashed border-border/60 p-4 flex items-start gap-3 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {isFree
                  ? "No payment required for this plan."
                  : "Payment is not collected yet — the checkout integration is still being connected. Your request is saved on this card."}
              </span>
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> This plan applies only to {bikeName}.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setStep("select")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button className="rounded-full flex-1" disabled={saving} onClick={confirm}>
                {isFree ? "Activate plan" : "Reserve plan"}
              </Button>
            </div>
          </motion.div>
        )}

        {step === "done" && (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-wj-green/15 flex items-center justify-center">
              {isFree ? (
                <Check className="h-6 w-6 text-wj-green" />
              ) : (
                <Sparkles className="h-6 w-6 text-wj-green" />
              )}
            </div>
            <p className="font-medium text-foreground">
              {isFree ? `${selected?.name} active` : `${selected?.name} awaiting payment`}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {isFree
                ? `${bikeName} now runs on its own membership.`
                : `We saved this upgrade on ${bikeName}. It activates as soon as the payment step goes live.`}
            </p>
            <Button className="rounded-full w-full mt-2" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}

        {step === "select" && currentPlan && (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Current plan on this card: {currentPlan.name}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
