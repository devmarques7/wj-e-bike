import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, RefreshCw, Bike, Package, MapPin, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import RichText from "@/components/dashboard/assistant/RichText";
import AgentOrb from "@/components/agent/AgentOrb";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK = [
  { icon: Bike, label: "Bikes in the garage now", prompt: "How many bikes are in the garage right now and which ones?" },
  { icon: ClipboardList, label: "Today's repairs", prompt: "List today's repair jobs with customer, bike serial and status." },
  { icon: Package, label: "Check a part in stock", prompt: "Do we have brake pads in stock and where are they?" },
  { icon: MapPin, label: "Where is this part?", prompt: "Where is the battery charger stored?" },
];

const ERRORS: Record<string, string> = {
  rate_limited: "Too many requests. Try again in a moment.",
  credits_exhausted: "AI credits exhausted. Please top up the workspace.",
  forbidden: "This assistant is only available to workshop staff.",
  not_authenticated: "Please sign in again.",
};

/** Workshop assistant: bikes in the garage, repairs and parts availability. */
export default function GarageAssistantCard({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);
    const next = [...messages, { id: crypto.randomUUID(), role: "user" as const, content: clean }];
    setMessages(next);
    setValue("");
    setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("garage-assistant", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (fnError) throw fnError;
      if (data?.error) {
        setError(ERRORS[data.error] ?? "The assistant could not answer right now.");
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data?.content ?? "" },
        ]);
      }
    } catch (_) {
      setError("The assistant is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <AgentOrb state={busy ? "thinking" : "idle"} size={36} />
          <div>
            <p className="text-sm text-foreground">Garage Assistant</p>
            <p className="text-[11px] text-muted-foreground">
              Bikes, repairs, briefings and parts location
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask anything about the workshop — which bikes are in, who owns them, what needs
              repair and whether the part is in stock.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={() => send(q.prompt)}
                  className="flex items-center gap-2 rounded-2xl border border-border/30 bg-background/40 px-3 py-2.5 text-left text-xs text-foreground hover:border-wj-green/50 transition-colors"
                >
                  <q.icon className="h-3.5 w-3.5 text-wj-green shrink-0" />
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("text-sm leading-relaxed", m.role === "user" ? "text-foreground" : "text-muted-foreground")}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                {m.role === "user" ? "You" : "Garage"}
              </p>
              <RichText text={m.content} />
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <p className="text-xs text-muted-foreground animate-pulse">Checking the workshop data…</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(value);
        }}
        className="flex items-center gap-2 border-t border-border/20 px-4 py-3"
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about a bike, a customer or a part…"
          className="border-0 bg-transparent focus-visible:ring-0 text-sm"
        />
        <Button type="submit" size="icon" disabled={busy || !value.trim()} className="h-9 w-9 rounded-full">
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}