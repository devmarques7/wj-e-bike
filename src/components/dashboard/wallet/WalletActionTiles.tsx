import { motion } from "framer-motion";
import { QrCode, Plus, GraduationCap, LayoutGrid, Crown, type LucideIcon } from "lucide-react";

interface WalletActionTilesProps {
  onScan: () => void;
  onAddCard: () => void;
  onTips: () => void;
  onPlans: () => void;
  onAllBikes: () => void;
}

const tileBase =
  "rounded-3xl border border-border/50 bg-card/60 backdrop-blur-md transition-colors hover:bg-card/90 text-left";

function WideTile({
  icon: Icon,
  label,
  onClick,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -3 }}
      className={`${tileBase} p-4 flex flex-col justify-between min-h-[120px]`}
    >
      <span className="w-10 h-10 rounded-2xl bg-wj-green/10 flex items-center justify-center">
        <Icon className="h-[18px] w-[18px] text-wj-green" />
      </span>
      <span className="block mt-4 text-sm font-semibold text-foreground leading-tight">{label}</span>
    </motion.button>
  );
}

/** Wallet shortcut layout: stacked square actions on the left, wide tiles on the right. */
export default function WalletActionTiles({
  onScan,
  onAddCard,
  onTips,
  onPlans,
  onAllBikes,
}: WalletActionTilesProps) {
  return (
    <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[72px_1fr] gap-3">
      {/* Left rail — scan + add card */}
      <div className="grid grid-rows-2 gap-3">
        <motion.button
          type="button"
          onClick={onScan}
          whileHover={{ y: -3 }}
          className={`${tileBase} !rounded-2xl flex items-center justify-center`}
          aria-label="Scan E-Pass"
        >
          <QrCode className="h-5 w-5 text-foreground" />
        </motion.button>
        <motion.button
          type="button"
          onClick={onAddCard}
          whileHover={{ y: -3 }}
          className={`${tileBase} !rounded-2xl flex items-center justify-center`}
          aria-label="Add card"
        >
          <Plus className="h-5 w-5 text-foreground" />
        </motion.button>
      </div>

      {/* Wide tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <WideTile icon={GraduationCap} label="Tips and training" onClick={onTips} delay={0.05} />
        <WideTile icon={Crown} label="Plans" onClick={onPlans} delay={0.1} />
        <WideTile icon={LayoutGrid} label="All bikes" onClick={onAllBikes} delay={0.15} />
      </div>
    </div>
  );
}
