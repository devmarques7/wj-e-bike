import { motion } from "framer-motion";
import { Check, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type DeliveryItem = { id: string; label: string; source: "reported" | "default" };

interface Props {
  items: DeliveryItem[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export default function DeliveryChecklistPanel({ items, checked, onToggle }: Props) {
  const done = items.filter((i) => checked[i.id]).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col rounded-2xl border border-border/30 bg-background/60 overflow-hidden"
    >
      <div className="p-4 border-b border-border/30 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Final stage</p>
          <h3 className="text-sm font-medium text-foreground">Delivery handover</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Confirm every point reported by the customer was reviewed before handing the bike back.
          </p>
        </div>
        <Badge className="text-[9px] h-5 px-2 bg-wj-green/15 text-wj-green border-wj-green/30 shrink-0">
          {done}/{items.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {items.map((item) => {
            const isChecked = !!checked[item.id];
            return (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                  isChecked
                    ? "bg-wj-green/10 border-wj-green/30"
                    : "bg-background/60 border-border/30 hover:bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                    isChecked ? "bg-wj-green border-wj-green" : "border-border",
                  )}
                >
                  {isChecked && <Check className="h-3 w-3 text-black" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs", isChecked && "line-through")}>{item.label}</p>
                  {item.source === "reported" && (
                    <Badge className="mt-1 text-[9px] h-4 px-1.5 bg-amber-500/15 text-amber-400 border-amber-500/30">
                      Reported by customer
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border/30 flex items-center gap-2 text-[10px] text-muted-foreground">
        <PackageCheck className="h-3.5 w-3.5 text-wj-green" />
        All items must be confirmed to complete the appointment.
      </div>
    </motion.div>
  );
}
