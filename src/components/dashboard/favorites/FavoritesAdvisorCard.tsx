import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bike, Check, Heart, Package, Shield, Sparkle, Wallet, Zap } from "lucide-react";
import AgentOrb from "@/components/agent/AgentOrb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchCatalog, type CatalogItem } from "@/lib/favorites/catalog";
import {
  ASSISTANT_CONFIG_STORAGE_KEY,
  DEFAULT_ASSISTANT_CONFIG,
  type AssistantConfig,
} from "@/lib/ai/skills";

function loadConfig(): AssistantConfig {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT_CONFIG;
  try {
    const raw = window.localStorage.getItem(ASSISTANT_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_ASSISTANT_CONFIG;
    return { ...DEFAULT_ASSISTANT_CONFIG, ...JSON.parse(raw) } as AssistantConfig;
  } catch {
    return DEFAULT_ASSISTANT_CONFIG;
  }
}

const QUICK_FILTERS = [
  { id: "bike", label: "E-bikes", icon: Bike },
  { id: "accessory", label: "Accessories", icon: Package },
  { id: "safety", label: "Safety", icon: Shield },
  { id: "tech", label: "Smart tech", icon: Zap },
  { id: "budget", label: "Under €600", icon: Wallet },
  { id: "premium", label: "Premium", icon: Sparkle },
];

interface Props {
  isFavorite: (id: string) => boolean;
  onAdd: (item: CatalogItem) => void;
}

export default function FavoritesAdvisorCard({ isFavorite, onAdd }: Props) {
  const config = useMemo(loadConfig, []);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [results, setResults] = useState<CatalogItem[] | null>(null);

  const toggleFilter = (id: string) =>
    setFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const runSearch = (q = query, f = filters) => {
    if (!q.trim() && f.length === 0) return;
    setThinking(true);
    setResults(null);
    window.setTimeout(() => {
      setResults(searchCatalog(q, f));
      setThinking(false);
    }, 1200);
  };

  return (
    <section className="rounded-3xl border border-border/40 bg-background/50 backdrop-blur-xl p-5 lg:p-6">
      <div className="flex items-start gap-4">
        <AgentOrb state={thinking ? "thinking" : "idle"} size={56} />
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest text-wj-green">{config.name}</p>
          <h2 className="text-lg lg:text-xl font-semibold text-foreground mt-1">
            What are you looking for today?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Describe your ride, your routine or a problem — I'll find products and build your list.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="mt-5 flex items-center gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. a light commuter bike and a secure lock"
          className="rounded-full h-11 bg-muted/40 border-border/40"
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full h-11 w-11 shrink-0"
          disabled={thinking}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => {
          const active = filters.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                const next = active ? filters.filter((x) => x !== f.id) : [...filters, f.id];
                toggleFilter(f.id);
                runSearch(query, next);
              }}
              className={cn(
                "flex items-center gap-2 px-3 h-8 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "border-wj-green/50 bg-wj-green/15 text-wj-green"
                  : "border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-wj-green/10",
              )}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {thinking && (
          <motion.p
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 text-sm text-muted-foreground"
          >
            Analysing the catalog for the best matches…
          </motion.p>
        )}

        {!thinking && results && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5"
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              {results.length} suggestions — drag them into a folder or add directly
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map((item) => {
                const saved = isFavorite(item.id);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                    className="rounded-2xl border border-border/40 bg-muted/30 p-3 flex gap-3 items-center cursor-grab active:cursor-grabbing hover:border-wj-green/40 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-xl bg-background/60 border border-border/30 flex items-center justify-center shrink-0">
                      {item.type === "bike" ? (
                        <Bike className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.tagline}</p>
                      <p className="text-xs text-wj-green mt-0.5">€{item.price.toLocaleString()}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full shrink-0"
                      onClick={() => onAdd(item)}
                      aria-label={saved ? "Already in favorites" : "Add to favorites"}
                    >
                      {saved ? (
                        <Check className="h-4 w-4 text-wj-green" />
                      ) : (
                        <Heart className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}