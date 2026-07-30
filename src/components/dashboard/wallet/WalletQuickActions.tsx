import { motion } from "framer-motion";
import { QrCode, HeartPulse, CalendarPlus, LayoutGrid, type LucideIcon } from "lucide-react";

export interface QuickAction {
  key: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Renders the tile with the brand accent fill. */
  accent?: boolean;
}

interface WalletQuickActionsProps {
  actions: QuickAction[];
}

/** Icon shortcuts row of the wallet (scan, health, booking, services). */
export default function WalletQuickActions({ actions }: WalletQuickActionsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((a, i) => (
        <motion.button
          key={a.key}
          type="button"
          onClick={a.onClick}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          whileHover={{ y: -3 }}
          className={[
            "rounded-3xl border p-4 text-left transition-colors min-h-[104px] flex flex-col justify-between",
            a.accent
              ? "border-wj-green/40 bg-wj-green/10 hover:bg-wj-green/15"
              : "border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/70",
          ].join(" ")}
        >
          <span className="w-9 h-9 rounded-xl bg-wj-green/10 flex items-center justify-center">
            <a.icon className="h-4.5 w-4.5 h-[18px] w-[18px] text-wj-green" />
          </span>
          <span className="block mt-3">
            <span className="block text-sm font-medium text-foreground leading-tight">{a.label}</span>
            {a.hint && (
              <span className="block text-[11px] text-muted-foreground mt-0.5">{a.hint}</span>
            )}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

export const quickActionIcons = { QrCode, HeartPulse, CalendarPlus, LayoutGrid };