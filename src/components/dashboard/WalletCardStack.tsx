import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import MemberPassCard from "@/components/dashboard/MemberPassCard";
import { useEPassCards, OwnedBike } from "@/hooks/useEPassCards";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Apple Wallet style: cards stack from the top, each one peeking above the next
const PEEK = 56; // px of each card visible in the stack

export default function WalletCardStack() {
  const { user } = useAuth();
  const { cards, availableBikes, loading, submitting, requestCard } = useEPassCards();
  const [selected, setSelected] = useState<string | null>(null);

  const handleRequest = async (bike?: OwnedBike) => {
    const res = await requestCard(bike);
    if ("error" in res && res.error) {
      toast({ title: "Request failed", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Card requested",
      description: "Your request was sent to the WJ team for approval. You'll be notified once it's active.",
    });
  };

  const stackHeight =
    cards.length === 0 ? 0 : (cards.length - 1) * PEEK + 220;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Wallet</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cards.filter((c) => c.status === "approved").length} active ·{" "}
            {cards.filter((c) => c.status === "pending").length} pending
          </p>
        </div>

        {availableBikes.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="rounded-full h-10 w-10" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-popover z-50">
              {availableBikes.map((bike) => (
                <DropdownMenuItem key={bike.id} onClick={() => handleRequest(bike)}>
                  <div className="flex flex-col">
                    <span className="text-sm">{bike.model}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{bike.serial || "no serial"}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full h-10 w-10"
            disabled={submitting || (cards.length > 0 && availableBikes.length === 0 && !user?.isDemo)}
            onClick={() => handleRequest()}
            aria-label="Request new card"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Stack */}
      {loading ? (
        <div className="h-48 rounded-2xl bg-muted/30 animate-pulse" />
      ) : cards.length === 0 ? (
        <button
          onClick={() => handleRequest(availableBikes[0])}
          className="w-full aspect-[1.586/1] rounded-2xl border border-dashed border-foreground/25 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-6 w-6" />
          <span className="text-sm">Request your E-Pass card</span>
        </button>
      ) : (
        <div className="relative" style={{ height: selected ? undefined : stackHeight }}>
          <AnimatePresence initial={false}>
            {cards.map((card, index) => {
              const isSelected = selected === card.id;
              const hidden = selected !== null && !isSelected;
              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={false}
                  animate={{
                    top: isSelected ? 0 : index * PEEK,
                    scale: hidden ? 0.92 : 1,
                    opacity: hidden ? 0 : 1,
                    y: hidden ? 40 : 0,
                    zIndex: isSelected ? 50 : index,
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  className={cn("absolute left-0 right-0", hidden && "pointer-events-none")}
                  onClick={() => setSelected(isSelected ? null : card.id)}
                >
                  <MemberPassCard
                    bikeId={card.serial}
                    bikeName={card.model}
                    purchaseDate={card.purchaseDate || undefined}
                    cardNumber={card.cardNumber}
                    tier={card.tier}
                    ghost={card.status !== "approved"}
                    flipEnabled={isSelected}
                  />

                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 rounded-2xl border border-border/50 bg-card/60 backdrop-blur p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Serial</span>
                        <span className="font-mono text-foreground">{card.serial}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Card number</span>
                        <span className="font-mono text-foreground">{card.cardNumber}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-medium capitalize",
                            card.status === "approved"
                              ? "text-primary"
                              : card.status === "rejected"
                                ? "text-destructive"
                                : "text-muted-foreground",
                          )}
                        >
                          {card.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {card.status}
                        </span>
                      </div>
                      {card.status === "pending" && (
                        <p className="text-[11px] text-muted-foreground pt-1">
                          Waiting for admin approval. The card stays inactive until then.
                        </p>
                      )}
                      {card.reviewNotes && (
                        <p className="text-[11px] text-muted-foreground pt-1">{card.reviewNotes}</p>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
