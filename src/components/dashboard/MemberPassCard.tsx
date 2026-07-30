import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Sparkles, Star, Wifi, Clock } from "lucide-react";
import { useAuth, MemberTier } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import StyledEPassQR from "@/components/dashboard/StyledEPassQR";
import { formatCardNumber, cardNumberFromSerial } from "@/hooks/useEPassCards";

interface MemberPassCardProps {
  bikeId?: string;
  bikeName?: string;
  purchaseDate?: string;
  /** Unique card number bound to the bike serial */
  cardNumber?: string;
  /** Ghost (not yet approved by an admin) */
  ghost?: boolean;
  tier?: MemberTier | string;
  /** Disable internal flip (used inside the wallet stack) */
  flipEnabled?: boolean;
}

const tierConfig: Record<string, { label: string; icon: typeof Crown; badge: string }> = {
  free: { label: "Free", icon: Star, badge: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30" },
  light: { label: "Light", icon: Star, badge: "bg-zinc-400/20 text-zinc-300 border-zinc-400/30" },
  plus: { label: "Plus", icon: Sparkles, badge: "bg-amber-400/20 text-amber-300 border-amber-400/30" },
  black: { label: "Black", icon: Crown, badge: "bg-white/10 text-white border-white/20" },
};

export default function MemberPassCard({
  bikeId,
  bikeName,
  purchaseDate,
  cardNumber,
  ghost = false,
  tier: tierProp,
  flipEnabled = true,
}: MemberPassCardProps) {
  const { user } = useAuth();
  const [isFlipped, setIsFlipped] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const tier = (tierProp || user?.tier || "light") as string;
  const config = tierConfig[tier] ?? tierConfig.light;
  const TierIcon = config.icon;

  const frontVideoSrc =
    tier === "light"
      ? "/videos/member-pass-light-bg.mp4"
      : tier === "plus"
        ? "/videos/member-pass-plus-bg.mp4"
        : "/videos/member-pass-bg.mp4";

  const displaySerial = bikeId || user?.bikeId || "V8-2024-XX-00000";
  const displayBikeName = bikeName || user?.bikeName || "WJ V8";
  const displayPurchaseDate = purchaseDate || user?.purchaseDate || "2024-01";
  const displayNumber = cardNumber || cardNumberFromSerial(displaySerial);

  const formattedDate = displayPurchaseDate
    ? new Date(displayPurchaseDate).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" })
    : "01/24";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      if (video.duration - video.currentTime < 0.5) {
        video.currentTime = 0;
        video.play();
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  return (
    <div
      className={cn(
        "relative w-full cursor-pointer",
        // Real credit-card ratio (ISO/IEC 7810 ID-1 — 85.6 x 53.98 mm)
        "aspect-[1.586/1]",
      )}
      style={{ perspective: "1200px" }}
      onClick={() => flipEnabled && !ghost && setIsFlipped((f) => !f)}
    >
      <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}>
        {/* Front */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-2xl overflow-hidden border shadow-2xl",
            ghost ? "border-dashed border-foreground/25" : "border-border/50",
          )}
          animate={{ rotateY: isFlipped ? 180 : 0, opacity: isFlipped ? 0 : 1 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
          style={{ backfaceVisibility: "hidden" }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            loop
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              ghost && "grayscale opacity-30",
            )}
          >
            <source src={frontVideoSrc} type="video/mp4" />
          </video>
          <div
            className={cn(
              "absolute inset-0",
              ghost
                ? "bg-background/70 backdrop-blur-[2px]"
                : "bg-gradient-to-br from-black/70 via-black/50 to-black/70",
            )}
          />

          <div className="relative z-10 h-full w-full flex flex-col justify-between p-4 sm:p-5 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className={cn("text-sm sm:text-base font-bold tracking-wider", ghost ? "text-foreground/70" : "text-white")}>
                  WJ VISION
                </p>
                <p className={cn("text-[9px] sm:text-[10px] tracking-widest uppercase mt-0.5", ghost ? "text-muted-foreground" : "text-white/40")}>
                  {displayBikeName}
                </p>
              </div>
              {ghost ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-foreground/20 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Pending
                </div>
              ) : (
                <Wifi className="h-5 w-5 sm:h-6 sm:w-6 text-white/60 rotate-90" />
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center", ghost ? "border-foreground/20 bg-foreground/5" : "border-white/20 bg-white/5")}>
                <div className={cn("w-5 h-5 sm:w-6 sm:h-6 rounded-md", ghost ? "bg-foreground/10" : "bg-white/10")} />
              </div>
            </div>

            <p className={cn("text-sm sm:text-lg lg:text-xl font-mono tracking-[0.12em] font-light", ghost ? "text-muted-foreground blur-[1px] select-none" : "text-white")}>
              {formatCardNumber(displayNumber)}
            </p>

            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className={cn("text-[7px] sm:text-[8px] uppercase tracking-widest", ghost ? "text-muted-foreground/70" : "text-white/40")}>Card Holder</p>
                <p className={cn("text-xs sm:text-sm font-medium uppercase tracking-wide truncate", ghost ? "text-foreground/70" : "text-white")}>
                  {user?.name || "MEMBER NAME"}
                </p>
              </div>
              <div className="flex items-end gap-3 sm:gap-4 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className={cn("text-[7px] sm:text-[8px] uppercase tracking-widest", ghost ? "text-muted-foreground/70" : "text-white/40")}>Valid</p>
                  <p className={cn("text-xs sm:text-sm font-mono", ghost ? "text-foreground/70" : "text-white")}>{formattedDate}</p>
                </div>
                <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider", ghost ? "border-foreground/20 text-muted-foreground" : config.badge)}>
                  <TierIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">{config.label}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Back */}
        <motion.div
          className="absolute inset-0 rounded-2xl overflow-hidden border border-border/50 shadow-2xl"
          animate={{ rotateY: isFlipped ? 0 : -180, opacity: isFlipped ? 1 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
          style={{ backfaceVisibility: "hidden" }}
        >
          <video autoPlay muted playsInline loop className="absolute inset-0 w-full h-full object-cover">
            <source src="/videos/member-pass-back-bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="rounded-2xl bg-background p-2 shadow-xl">
              <StyledEPassQR data={`https://wjbikes.nl/epass/${displaySerial}`} size={120} />
            </div>
          </div>
          <div className="relative z-20 h-full w-full flex items-end justify-center pb-3">
            <p className="text-[10px] text-white/60 tracking-widest uppercase font-mono">{displaySerial}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
