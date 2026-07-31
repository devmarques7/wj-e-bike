import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getWalletTheme } from "@/lib/wallet/cardThemes";
import { CardMeshBackground, tierFromPlan, type CardTier } from "./CardMeshBackground";

export interface WalletMemberCardProps {
  /** Mirrors the layout (dark panel moves to the right) — used for the card back. */
  mirrored?: boolean;
  themeId?: string | null;
  /** Overrides the plan tier used for the background palette. */
  tier?: CardTier;
  /** Top-left label, e.g. "Member card". */
  label?: string;
  bikeName?: string;
  serial?: string;
  planName?: string;
  memberName?: string;
  cardNumber?: string;
  points?: number;
  pointsLabel?: string;
  /** Shows the edit affordance in the top-right corner. */
  showEdit?: boolean;
  onEdit?: () => void;
  editLabel?: string;
  className?: string;
}

/**
 * Single reusable E-Pass card face. Every wallet card uses this exact layout —
 * only the colour theme changes.
 */
export default function WalletMemberCard({
  mirrored,
  themeId,
  tier,
  label = "Member card",
  bikeName,
  serial,
  planName,
  memberName,
  cardNumber,
  points,
  pointsLabel = "Points",
  showEdit,
  onEdit,
  editLabel = "Edit card colour",
  className,
}: WalletMemberCardProps) {
  const theme = getWalletTheme(themeId);

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden rounded-3xl flex", mirrored && "flex-row-reverse", className)}
      style={{ background: theme.background }}
    >
      {/* Dark chip panel — full height, left side */}
      <div
        className="relative h-full w-[34%] shrink-0 flex items-end gap-3 p-4"
        style={{ background: theme.panel }}
      >
        <span
          className="text-[8px] uppercase tracking-[0.25em] font-medium [writing-mode:vertical-rl] rotate-180"
          style={{ color: theme.panelInk, opacity: 0.7 }}
        >
          {planName || "Member"}
        </span>
        <div className="flex flex-col gap-3 pb-0.5">
          <div className="h-7 w-10 rounded-md bg-gradient-to-br from-zinc-200 to-zinc-400 border border-white/30" />
          <div className="flex items-center">
            <span className="h-6 w-6 rounded-full bg-zinc-400/90" />
            <span className="h-6 w-6 -ml-2.5 rounded-full bg-zinc-100/90" />
          </div>
        </div>
      </div>

      {/* Colour side */}
      <div className="relative flex-1 min-w-0 flex flex-col">
        <CardMeshBackground tier={tier ?? tierFromPlan(planName)} />

        {/* Oversized wordmark */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[5rem] sm:text-[6.5rem] font-black leading-none tracking-tighter select-none"
          style={{ color: theme.ink, opacity: 0.12 }}
        >
          WJ
        </span>

        {/* Header */}
        <div className="relative z-10 p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.22em] font-medium" style={{ color: theme.inkMuted }}>
            {label}
          </p>
          <h3 className="text-sm sm:text-base font-bold tracking-tight truncate max-w-[150px]" style={{ color: theme.ink }}>
            {bikeName || "WJ Vision"}
          </h3>
          {serial && (
            <p className="text-[9px] font-mono tracking-wider truncate max-w-[150px]" style={{ color: theme.inkMuted }}>
              {serial}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {planName && (
            <span
              className="px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider"
              style={{ color: theme.ink, borderColor: theme.ink }}
            >
              {planName}
            </span>
          )}
          {showEdit && (
            <button
              type="button"
              aria-label={editLabel}
              title={editLabel}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className="h-7 w-7 rounded-full flex items-center justify-center border transition-opacity hover:opacity-70"
              style={{ borderColor: theme.ink, color: theme.ink }}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        </div>

        {/* Bottom-right details */}
        <div className="mt-auto relative z-10 px-4 sm:px-5 pb-4 sm:pb-5 text-right space-y-2">
        {cardNumber && (
          <p className="text-base sm:text-lg font-mono font-semibold tracking-[0.08em] whitespace-nowrap" style={{ color: theme.ink }}>
            {cardNumber}
          </p>
        )}
        {memberName && (
          <div>
            <p className="text-[8px] uppercase tracking-widest" style={{ color: theme.inkMuted }}>
              Member
            </p>
            <p className="text-xs font-semibold" style={{ color: theme.ink }}>
              {memberName}
            </p>
          </div>
        )}
        {typeof points === "number" && (
          <div>
            <p className="text-[8px] uppercase tracking-widest" style={{ color: theme.inkMuted }}>
              {pointsLabel}
            </p>
            <p className="text-sm font-bold" style={{ color: theme.ink }}>
              {points.toLocaleString()}
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
export interface WalletCardBackProps {
  themeId?: string | null;
  /** Overrides the plan tier used for the background palette. */
  tier?: CardTier;
  /** QR node rendered inside the dark panel (right side). */
  qr?: ReactNode;
  planName?: string;
  label?: string;
  rows?: { label: string; value: string }[];
  className?: string;
}

/**
 * Back face of the E-Pass card. Same geometry as the front, but mirrored:
 * the dark panel sits on the right (it becomes the left panel once flipped back).
 */
export function WalletCardBack({
  themeId,
  tier,
  qr,
  planName,
  label = "E-Pass",
  rows = [],
  className,
}: WalletCardBackProps) {
  const theme = getWalletTheme(themeId);

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden rounded-3xl flex flex-row-reverse", className)}
      style={{ background: theme.background }}
    >
      {/* Dark panel — full height, right side (mirrors the front) */}
      <div
        className="relative h-full w-[42%] shrink-0 flex items-center justify-center gap-2 p-3"
        style={{ background: theme.panel }}
      >
        <span
          className="text-[8px] uppercase tracking-[0.25em] font-medium [writing-mode:vertical-rl]"
          style={{ color: theme.panelInk, opacity: 0.7 }}
        >
          {planName || "Member"}
        </span>
        <div className="flex-1 max-w-[150px] aspect-square flex items-center justify-center overflow-hidden">
          {qr}
        </div>
      </div>

      {/* Colour side — details */}
      <div className="relative flex-1 min-w-0 flex flex-col p-4 sm:p-5">
        <CardMeshBackground tier={tier ?? tierFromPlan(planName)} />

        <div className="relative z-10">
          <p className="text-[9px] uppercase tracking-[0.22em] font-medium" style={{ color: theme.inkMuted }}>
            {label}
          </p>
          <span className="text-xl font-black tracking-tight" style={{ color: theme.ink }}>
            WJ
          </span>
        </div>

        <div className="relative z-10 mt-auto space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest" style={{ color: theme.inkMuted }}>
                {row.label}
              </p>
              <p className="text-[11px] sm:text-xs font-semibold truncate" style={{ color: theme.ink }}>
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
