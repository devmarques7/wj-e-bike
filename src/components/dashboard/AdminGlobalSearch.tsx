import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, Wrench, Package, CreditCard, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useGlobalSearch, type SearchCategory } from "@/hooks/admin/useGlobalSearch";

const CATEGORIES: { key: SearchCategory | "all"; label: string; icon: any }[] = [
  { key: "all", label: "All", icon: Search },
  { key: "customers", label: "Customers", icon: Users },
  { key: "services", label: "Services", icon: Wrench },
  { key: "products", label: "Products", icon: Package },
  { key: "plans", label: "Plans", icon: CreditCard },
];

const ICONS: Record<SearchCategory, any> = {
  customers: Users,
  services: Wrench,
  products: Package,
  plans: CreditCard,
};

export default function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchCategory | "all">("all");
  const { results, counts, loading, hasQuery } = useGlobalSearch(query);

  const visible = filter === "all" ? results : results.filter((r) => r.category === filter);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="h-full">
      <Card className="h-full bg-background/60 backdrop-blur-md border-border/30 rounded-2xl overflow-hidden flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Search className="h-5 w-5 text-wj-green" />
            Global search
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, services, parts, bikes, plans…"
            className="bg-background/60 border-border/40 rounded-xl"
          />

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const count = c.key === "all" ? results.length : counts[c.key] ?? 0;
              return (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    filter === c.key
                      ? "border-wj-green/40 bg-wj-green/15 text-wj-green"
                      : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                  {hasQuery && <span className="opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {!hasQuery ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Type at least 2 characters to search across the whole system.
              </p>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : visible.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No results for “{query}”.</p>
            ) : (
              visible.map((r) => {
                const Icon = ICONS[r.category];
                return (
                  <Link
                    key={r.id}
                    to={r.link}
                    className="group flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 px-3 py-2.5 hover:bg-wj-green/10 hover:border-wj-green/30 transition-colors"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-wj-green/10 text-wj-green">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-foreground truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="block text-xs text-muted-foreground truncate">{r.subtitle}</span>
                      )}
                    </span>
                    {r.value && <span className="text-sm text-wj-green">{r.value}</span>}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
