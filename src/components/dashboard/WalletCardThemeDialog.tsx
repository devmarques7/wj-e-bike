import { Check } from "lucide-react";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
          <DialogDescription>
            Pick a colour for this card. The layout stays exactly the same.
          </DialogDescription>
        </DialogHeader>

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