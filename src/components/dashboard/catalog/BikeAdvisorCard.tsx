import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw } from "lucide-react";
import AgentOrb from "@/components/agent/AgentOrb";
import { Button } from "@/components/ui/button";
import { bikeProducts, BikeProduct } from "@/data/products";
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

type RideType = "city" | "commuter" | "sport" | "cargo";
type NeedId = "range" | "light" | "speed" | "load" | "budget" | "tech";

const RIDE_OPTIONS: { id: RideType; label: string; hint: string }[] = [
  { id: "city", label: "City rides", hint: "Short daily trips" },
  { id: "commuter", label: "Commuting", hint: "Home to work, every day" },
  { id: "sport", label: "Sport & trails", hint: "Performance and terrain" },
  { id: "cargo", label: "Cargo & family", hint: "Kids, groceries, loads" },
];

const NEED_OPTIONS: { id: NeedId; label: string }[] = [
  { id: "range", label: "Maximum range" },
  { id: "light", label: "Lightweight frame" },
  { id: "speed", label: "Top speed" },
  { id: "load", label: "Carrying capacity" },
  { id: "budget", label: "Best value" },
  { id: "tech", label: "Smart tech" },
];

const num = (value: string) => parseFloat(value.replace(/[^\d.]/g, "")) || 0;

export function scoreBike(bike: BikeProduct, ride: RideType | null, needs: NeedId[]) {
  let score = 0;
  if (ride && bike.category === ride) score += 50;
  if (needs.includes("range")) score += num(bike.specs.range) / 6;
  if (needs.includes("speed")) score += num(bike.specs.speed) / 2;
  if (needs.includes("light")) score += Math.max(0, 40 - num(bike.specs.weight));
  if (needs.includes("load")) score += bike.category === "cargo" ? 25 : 0;
  if (needs.includes("budget")) score += Math.max(0, 30 - bike.price / 200);
  if (needs.includes("tech")) score += bike.features.length * 3;
  if (bike.isBestseller) score += 4;
  if (bike.isNew) score += 2;
  return score;
}

interface Props {
  onRecommend: (bike: BikeProduct | null, ride: RideType | null) => void;
}

export default function BikeAdvisorCard({ onRecommend }: Props) {
  const config = useMemo(loadConfig, []);
  const [ride, setRide] = useState<RideType | null>(null);
  const [needs, setNeeds] = useState<NeedId[]>([]);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<BikeProduct | null>(null);

  const toggleNeed = (id: NeedId) =>
    setNeeds((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));

  const analyse = () => {
    setThinking(true);
    setTimeout(() => {
      const best = [...bikeProducts].sort(
        (a, b) => scoreBike(b, ride, needs) - scoreBike(a, ride, needs),
      )[0];
      setResult(best ?? null);
      setThinking(false);
      onRecommend(best ?? null, ride);
    }, 2000);
  };

  const reset = () => {
    setRide(null);
    setNeeds([]);
    setResult(null);
    onRecommend(null, null);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 lg:p-7">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex md:flex-col items-center md:items-start gap-4 md:w-40 shrink-0">
          <AgentOrb state={thinking ? "thinking" : result ? "speaking" : "idle"} size={96} />
          <div>
            <p className="text-xs uppercase tracking-widest text-wj-green">Bike advisor</p>
            <p className="text-sm text-muted-foreground">{config.name}</p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {thinking ? (
              <motion.p
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg text-foreground/80"
              >
                Matching your riding profile with the collection...
              </motion.p>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <h2 className="text-xl lg:text-2xl font-semibold text-foreground">
                  Your best match is the {result.name}.
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {result.tagline} — {result.specs.range} range, {result.specs.speed} top speed and{" "}
                  {result.specs.weight} frame. It fits your {ride ?? "riding"} profile
                  {needs.length > 0 && ` and your focus on ${needs.join(", ")}`}.
                </p>
                <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Start over
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="quiz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                <h2 className="text-xl lg:text-2xl font-semibold text-foreground">
                  Hey, my name is {config.name}. What kind of bike are you looking for?
                </h2>

                <div className="flex flex-wrap gap-2">
                  {RIDE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setRide(option.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                        ride === option.id
                          ? "border-wj-green bg-wj-green/15 text-foreground"
                          : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-wj-green/10"
                      }`}
                    >
                      {option.label}
                      <span className="ml-2 text-xs opacity-60">{option.hint}</span>
                    </button>
                  ))}
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    And what do you usually need most?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {NEED_OPTIONS.map((option) => {
                      const active = needs.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleNeed(option.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                            active
                              ? "border-wj-green bg-wj-green/15 text-foreground"
                              : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-wj-green/10"
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 text-wj-green" />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={analyse} disabled={!ride && needs.length === 0}>
                  Find my bike
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}