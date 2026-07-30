import { Check, Crown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WALLET_CARD_THEMES } from "@/lib/wallet/cardThemes";
import { cn } from "@/lib/utils";
import WalletMemberCard from "@/components/dashboard/WalletMemberCard";

interface WalletCardThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeId?: string | null;
  onSelect: (themeId: string) => void;
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
  preview,
}: WalletCardThemeDialogProps) {
  const navigate = useNavigate();
  return (
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
                  style={{ background: t.swatch }}
                >
                  {active && <Check className="h-4 w-4 text-background drop-shadow" />}
                </span>
                <span className="text-[10px] text-muted-foreground">{t.label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}