import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, RefreshCw, Settings2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBikeAssistant } from "@/hooks/useBikeAssistant";
import { ASSISTANT_SKILLS } from "@/lib/ai/skills";
import AssistantSettingsDialog from "./AssistantSettingsDialog";
import { AssistantIcon } from "./assistantIcons";
import { cn } from "@/lib/utils";
import AgentOrb from "@/components/agent/AgentOrb";
import { useAuth } from "@/contexts/AuthContext";

export default function BikeAssistantCard() {
  const { user } = useAuth();
  const { config, updateConfig, toggleSkill, activeSkills, messages, status, error, send, reset, runAction, savedCalls } =
    useBikeAssistant();
  const [value, setValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.name?.split(" ")[0] ?? "rider";
  const busy = status !== "idle";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const submit = async (text: string) => {
    if (!text.trim() || busy) return;
    setValue("");
    await send(text);
  };

  const suggestions = activeSkills.slice(0, 4);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-wj-green/15 border border-wj-green/30 flex items-center justify-center text-wj-green">
            <AssistantIcon name={config.icon} className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{config.name} Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={reset} aria-label="New conversation">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Assistant settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative px-5 py-6">
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[220px] w-[420px] -translate-x-1/2 rounded-full bg-wj-green/10 blur-[90px]" />

        <div ref={scrollRef} className="relative z-10 max-h-[320px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex justify-center">
                <AgentOrb
                  size={96}
                  state={status === "thinking" ? "thinking" : busy ? "speaking" : "idle"}
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                {config.name}, <span className="text-wj-green">what would you like to know?</span>
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Ask about your bike, services, prices, plans or the catalog — {config.name} reads
                live data from your account.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {suggestions.map((skill) => {
                  const Icon = skill.icon;
                  const prompt = skill.samplePrompts[0];
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => submit(prompt)}
                      className="group rounded-2xl border border-border/30 bg-background/50 p-3 text-left transition-colors hover:border-wj-green/40 hover:bg-wj-green/5"
                    >
                      <p className="text-xs font-medium text-foreground line-clamp-2">{prompt}</p>
                      <Icon className="mt-3 h-4 w-4 text-muted-foreground group-hover:text-wj-green" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div className="max-w-[85%] space-y-2">
                    <div
                      className={cn(
                        "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                        m.role === "user"
                          ? "bg-wj-green/15 text-foreground border border-wj-green/25"
                          : "bg-background/70 text-foreground border border-border/30",
                      )}
                    >
                      {m.content}
                    </div>
                    {m.role === "assistant" && (
                      <div className="flex flex-wrap items-center gap-2">
                        {m.source === "local" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-wj-green/30 bg-wj-green/10 px-2 py-0.5 text-[10px] text-wj-green">
                            <Zap className="h-3 w-3" /> instant
                          </span>
                        )}
                        {m.action && (
                          <button
                            type="button"
                            onClick={() => runAction(m.action!)}
                            className="rounded-full border border-wj-green/40 bg-wj-green/10 px-3 py-1 text-[11px] text-wj-green transition-colors hover:bg-wj-green/20"
                          >
                            {m.action.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <AnimatePresence>
                {busy && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <AgentOrb size={28} state={status === "thinking" ? "thinking" : "speaking"} />
                    {status === "thinking" ? "Thinking..." : `${config.name} is answering...`}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {error && <p className="relative z-10 mt-3 text-xs text-destructive">{error}</p>}

        {/* Composer */}
        <div className="relative z-10 mt-5 rounded-2xl border border-border/30 bg-background/70 p-2">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(value);
              }}
              placeholder="Ask whatever you want..."
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={busy}
            />
            <Button
              size="icon"
              onClick={() => submit(value)}
              disabled={busy || !value.trim()}
              className="h-9 w-9 shrink-0 rounded-full bg-wj-green text-white hover:bg-wj-green/90"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1 pb-1">
            {ASSISTANT_SKILLS.map((skill) => {
              const enabled = config.enabledSkills.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    enabled
                      ? "border-wj-green/40 bg-wj-green/10 text-wj-green"
                      : "border-border/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {skill.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AssistantSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        updateConfig={updateConfig}
        toggleSkill={toggleSkill}
      />
    </div>
  );
}