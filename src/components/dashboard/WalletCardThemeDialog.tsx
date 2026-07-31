import { useState } from "react";
import { Check, Crown, ArrowRight, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WALLET_CARD_THEMES } from "@/lib/wallet/cardThemes";
import { meshPaletteFor, tierFromPlan } from "./CardMeshBackground";
import { cn } from "@/lib/utils";
import WalletMemberCard from "@/components/dashboard/WalletMemberCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WalletCardThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeId?: string | null;
  onSelect: (themeId: string) => void;
  /** Bike whose registration/subscription this card represents. */
  bikeId?: string | null;
  /** Called after the bike registration was archived (soft-deleted). */
  onCancelled?: (bikeId: string) => void;
  preview?: {
    label?: string;
    bikeName?: string;
    serial?: string;
    planName?: string;
    memberName?: string;
    cardNumber?: string;
  };
}

export default function WalletCardThemeDialog({
  open,
  onOpenChange,
  themeId,
  onSelect,
  bikeId,
  onCancelled,
  preview,
}: WalletCardThemeDialogProps) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** Soft-delete: archives the bike registration and cancels the plan when no bikes remain. */
  const handleCancelSubscription = async () => {
    if (!bikeId) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("fn_cancel_bike_subscription", {
      p_bike_id: bikeId,
      p_reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Could not cancel this subscription");
      return;
    }
    toast.success("Subscription cancelled and bike registration archived");
    setConfirmOpen(false);
    setReason("");
    onOpenChange(false);
    onCancelled?.(bikeId);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
          <DialogDescription>
            Pick a colour for this card. The layout stays exactly the same.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            navigate("/dashboard/membership");
          }}
          className="group flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/20"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Crown className="h-4 w-4 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              Upgrade to the next plan
            </span>
            <span className="block text-xs text-muted-foreground">
              Unlock exclusive card finishes and more services.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
        </button>

        <div className="aspect-[1.75/1] w-full rounded-3xl overflow-hidden shadow-xl">
          <WalletMemberCard themeId={themeId} {...preview} />
        </div>

        <div className="grid grid-cols-4 gap-3 pt-1">
          {WALLET_CARD_THEMES.map((t) => {
            const active = t.id === themeId;
            // Swatch mirrors the tier-graded mesh the card will actually render.
            const palette = meshPaletteFor(tierFromPlan(preview?.planName), t.hues);
            const swatch = `linear-gradient(135deg, ${palette.colors[0]} 0%, ${palette.colors[2]} 55%, ${palette.colors[4]} 100%)`;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-muted/50",
                  active && "bg-muted/70",
                )}
              >
                <span
                  className={cn(
                    "h-10 w-10 rounded-full border-2 flex items-center justify-center",
                    active ? "border-primary" : "border-border",
                  )}
                  style={{ background: swatch }}
                >
                  {active && <Check className="h-4 w-4 text-background drop-shadow" />}
                </span>
                <span className="text-[10px] text-muted-foreground">{t.label}</span>
              </button>
            );
          })}
        </div>

        {bikeId && (
          <div className="mt-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left transition-colors hover:bg-destructive/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/20">
                <Trash2 className="h-4 w-4 text-destructive" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Cancel subscription for this bike
                </span>
                <span className="block text-xs text-muted-foreground">
                  Removes this card and archives the bike registration.
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-destructive transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel subscription for this bike?</AlertDialogTitle>
          <AlertDialogDescription>
            The card is removed from your wallet and {preview?.bikeName || "this bike"} is archived.
            Nothing is deleted from our records — the registration and its service history stay stored
            in the archived registrations table and can be restored by our team.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="min-h-[80px]"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Keep subscription</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleCancelSubscription(); }}
            disabled={submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel subscription
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}