import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedBike } from "@/contexts/SelectedBikeContext";
import { useBikeSubscriptions } from "@/hooks/plans/useBikeSubscriptions";
import WalletMemberCard from "./WalletMemberCard";

/** Card theme per plan slug — same palettes used across My Wallet. */
const THEME_BY_SLUG: Record<string, string> = {
  free: "wj-green",
  light: "sand",
  plus: "cobalt",
  black: "graphite",
};

const maskedNumber = (serial: string | null | undefined) =>
  `4532 •••• •••• ${(serial ?? "").replace(/\D/g, "").slice(-4).padStart(4, "0")}`;

/**
 * Horizontal E-Pass carousel. Each card is one registered bike with its own
 * membership plan — picking a card changes the globally selected bike.
 */
export default function MemberCardCarousel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { bikes, bike, selectBike } = useSelectedBike();
  const bikeIds = useMemo(() => bikes.map((b) => b.id), [bikes]);
  const { planForBike } = useBikeSubscriptions(user?.id, bikeIds);

  const trackRef = useRef<HTMLDivElement>(null);
  const activeId = bike?.id ?? null;

  // Keep the active card in view whenever the selection changes elsewhere.
  useEffect(() => {
    if (!activeId || !trackRef.current) return;
    const el = trackRef.current.querySelector<HTMLElement>(`[data-bike="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  const scrollBy = (dir: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir * (track.clientWidth * 0.85), behavior: "smooth" });
  };

  if (!bikes.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative h-full min-h-[180px]"
    >
      <div
        ref={trackRef}
        className="flex h-full gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {bikes.map((b) => {
          const plan = planForBike(b.id);
          const slug = (plan?.slug ?? "free").toLowerCase();
          const active = b.id === activeId;
          return (
            <button
              key={b.id}
              data-bike={b.id}
              type="button"
              onClick={() => (active ? navigate(`/dashboard/e-pass?bike=${b.id}`) : selectBike(b.id))}
              className={cn(
                "relative shrink-0 w-full snap-center rounded-3xl overflow-hidden text-left transition-all duration-300",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "ring-2 ring-wj-green/60 scale-100"
                  : "opacity-60 scale-[0.97] hover:opacity-90",
              )}
            >
              <WalletMemberCard
                themeId={THEME_BY_SLUG[slug] ?? "wj-green"}
                label="Member card"
                bikeName={b.model}
                planName={(plan?.name ?? "Free").toUpperCase()}
                cardNumber={maskedNumber(b.serial)}
                memberName={user?.name || "Guest"}
                className="h-full min-h-[180px]"
              />
            </button>
          );
        })}
      </div>

      {bikes.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous card"
            onClick={() => scrollBy(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/70 backdrop-blur-md border border-border/40 flex items-center justify-center text-foreground/80 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next card"
            onClick={() => scrollBy(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/70 backdrop-blur-md border border-border/40 flex items-center justify-center text-foreground/80 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {bikes.map((b) => (
              <span
                key={b.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  b.id === activeId ? "w-4 bg-wj-green" : "w-1.5 bg-foreground/30",
                )}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
