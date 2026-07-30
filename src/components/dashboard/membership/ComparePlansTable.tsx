import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanWithActiveVersion } from "@/hooks/plans/usePlansData";

const intervalLabel: Record<string, string> = {
  monthly: "/mo",
  quarterly: "/quarter",
  yearly: "/year",
  lifetime: " once",
};

export default function ComparePlansTable({
  plans,
  currentPlanId,
  onSelect,
}: {
  plans: PlanWithActiveVersion[];
  currentPlanId: string | null;
  onSelect: (plan: PlanWithActiveVersion) => void;
}) {
  // Union of every feature across all active versions, preserving first-seen order.
  const features: string[] = [];
  plans.forEach((p) =>
    (p.activeVersion?.features ?? []).forEach((f) => {
      if (!features.includes(f)) features.push(f);
    }),
  );
  features.push("Urgent service included");

  const has = (p: PlanWithActiveVersion, f: string) =>
    f === "Urgent service included"
      ? !!p.activeVersion?.urgent_service_included
      : (p.activeVersion?.features ?? []).includes(f);

  return (
    <div className="rounded-3xl border border-border/40 bg-background/50 backdrop-blur-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left p-4 font-medium text-muted-foreground w-[38%]">
                What's included
              </th>
              {plans.map((p) => (
                <th key={p.id} className="p-4 text-center">
                  <p
                    className={cn(
                      "font-semibold",
                      p.id === currentPlanId ? "text-wj-green" : "text-foreground",
                    )}
                  >
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.activeVersion
                      ? `€${Number(p.activeVersion.price).toFixed(2)}${
                          intervalLabel[p.activeVersion.interval] ?? ""
                        }`
                      : "—"}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f} className="border-b border-border/20 hover:bg-wj-green/5 transition-colors">
                <td className="p-4 text-muted-foreground">{f}</td>
                {plans.map((p) => (
                  <td key={p.id} className="p-4 text-center">
                    {has(p, f) ? (
                      <Check className="h-4 w-4 text-wj-green mx-auto" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4" />
              {plans.map((p) => (
                <td key={p.id} className="p-4 text-center">
                  <Button
                    size="sm"
                    className="rounded-full w-full"
                    variant={p.id === currentPlanId ? "outline" : "default"}
                    disabled={p.id === currentPlanId || !p.activeVersion}
                    onClick={() => onSelect(p)}
                  >
                    {p.id === currentPlanId ? "Current" : "Upgrade"}
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}