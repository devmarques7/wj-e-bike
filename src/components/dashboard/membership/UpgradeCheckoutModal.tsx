import { useState } from "react";
import { CreditCard, Lock, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { PlanWithActiveVersion } from "@/hooks/plans/usePlansData";

const intervalLabel: Record<string, string> = {
  monthly: "per month",
  quarterly: "per quarter",
  yearly: "per year",
  lifetime: "one-time",
};

export default function UpgradeCheckoutModal({
  plan,
  open,
  onOpenChange,
}: {
  plan: PlanWithActiveVersion | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const v = plan?.activeVersion;
  const price = v ? Number(v.price) : 0;
  const vat = price * 0.21;

  const handleConfirm = () => {
    setConfirmed(true);
    toast.success("Upgrade request confirmed", {
      description: "Payment processing will be enabled once Stripe is connected.",
    });
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setConfirmed(false);
      setName("");
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade to {plan?.name}</DialogTitle>
          <DialogDescription>
            Review your membership change before confirming.
          </DialogDescription>
        </DialogHeader>

        {confirmed ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-wj-green/15 flex items-center justify-center">
              <Check className="h-6 w-6 text-wj-green" />
            </div>
            <p className="font-medium text-foreground">Upgrade confirmed</p>
            <p className="text-sm text-muted-foreground">
              Secure payment will be collected as soon as Stripe checkout is live.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{plan?.name} membership</span>
                <span className="text-foreground">€{price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT (21%)</span>
                <span className="text-foreground">€{vat.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total {v ? intervalLabel[v.interval] : ""}</span>
                <span className="text-wj-green">€{(price + vat).toFixed(2)}</span>
              </div>
              {v && v.trial_days > 0 && (
                <p className="text-xs text-wj-green">
                  First {v.trial_days} days free — charged after the trial ends.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardholder">Cardholder name</Label>
              <Input
                id="cardholder"
                placeholder="Name on card"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-dashed border-border/50 p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>Card details will be collected securely by Stripe checkout.</span>
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Your membership renews automatically. Cancel anytime.
            </p>
          </div>
        )}

        <DialogFooter>
          {confirmed ? (
            <Button className="rounded-full w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" className="rounded-full" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button className="rounded-full" disabled={!name.trim()} onClick={handleConfirm}>
                Confirm upgrade
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}