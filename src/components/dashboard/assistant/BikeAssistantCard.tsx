import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, RefreshCw, Settings2, Zap, Stethoscope, Wrench, Package, Tag, Bike } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBikeAssistant } from "@/hooks/useBikeAssistant";
import { ASSISTANT_SKILLS } from "@/lib/ai/skills";
import AssistantSettingsDialog from "./AssistantSettingsDialog";
import { AssistantIcon } from "./assistantIcons";
import { cn } from "@/lib/utils";
import AgentOrb from "@/components/agent/AgentOrb";
import { useAuth } from "@/contexts/AuthContext";
import BikeDiagnosisDialog from "./BikeDiagnosisDialog";
import type { SymptomId } from "@/lib/ai/diagnosis";
import type { AssistantAction } from "@/lib/ai/intents";

/** The assistant's priority flows, in the order we want riders to use them. */
const PRIORITY_ACTIONS = [
  { icon: Stethoscope, label: "Book a revision", prompt: "I want to book a revision for my bike", primary: true },
  { icon: Wrench, label: "My bike has a problem", prompt: "My bike is not working properly" },
  { icon: Package, label: "Find a part that fixes it", prompt: "Which part solves my problem?" },
  { icon: Tag, label: "Is it covered by my plan?", prompt: "Is this service covered by my plan?" },
  { icon: Bike, label: "Explore new bikes", prompt: "Which bike should I upgrade to?" },
];

export default function BikeAssistantCard() {
  const { user } = useAuth();
  const {
    config,
    updateConfig,
    toggleSkill,
    activeSkills,
    messages,
    status,
    thinkingPhrase,
    error,
    send,
    reset,
    runAction,
    savedCalls,
  } = useBikeAssistant();
  const [value, setValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [diagnosisSymptom, setDiagnosisSymptom] = useState<SymptomId | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
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

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null;
  const orbInComposer = inputFocused && messages.length > 0;

  const handleAction = (action: AssistantAction) => {
    if (action.type === "diagnose") {
      setDiagnosisSymptom(action.symptom ?? null);
      setDiagnosisOpen(true);
      return;
    }
    runAction(action);
  };

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

        <div
          ref={scrollRef}
          className={cn(
            "relative z-10 overflow-y-auto",
            messages.length > 0 &&
              "max-h-[440px] rounded-2xl border border-border/25 bg-black/45 p-4 backdrop-blur-sm",
            messages.length === 0 && "max-h-[320px]",
          )}
        >
          {messages.length === 0 ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex justify-center">
                <AgentOrb
                  size={96}
                  state={status === "thinking" ? "thinking" : busy ? "speaking" : "idle"}
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Hey, my name is <span className="text-wj-green">{config.name}</span>. How can I help you today?
              </h3>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {PRIORITY_ACTIONS.map(({ icon: Icon, label, prompt, primary }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => submit(prompt)}
                    className={cn(
                      "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left transition-colors",
                      primary
                        ? "border-wj-green/50 bg-wj-green/15 hover:bg-wj-green/25"
                        : "border-border/30 bg-muted/50 hover:border-wj-green/40 hover:bg-wj-green/10",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        primary ? "text-wj-green" : "text-muted-foreground group-hover:text-wj-green",
                      )}
                    />
                    <span className="whitespace-nowrap text-xs font-medium text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline connector */}
              <div className="pointer-events-none absolute bottom-2 left-[17px] top-2 w-px bg-gradient-to-b from-wj-green/10 via-wj-green/25 to-wj-green/50" />

              <div className="space-y-4">
                {messages.map((m) => {
                  const isLast = m.id === lastAssistantId;
                  const isAssistant = m.role === "assistant";
                  return (
                    <div key={m.id} className="relative flex gap-3">
                      {/* Rail */}
                      <div className="relative z-10 flex w-[34px] shrink-0 justify-center pt-1.5">
                        {isAssistant && isLast && !orbInComposer ? (
                          <motion.div layoutId="assistant-orb">
                            <AgentOrb
                              size={34}
                              state={
                                status === "thinking"
                                  ? "thinking"
                                  : status === "answering"
                                    ? "speaking"
                                    : "idle"
                              }
                            />
                          </motion.div>
                        ) : (
                          <span
                            className={cn(
                              "mt-2 h-2 w-2 rounded-full ring-4 ring-background/60",
                              isAssistant ? "bg-wj-green/60" : "bg-muted-foreground/40",
                            )}
                          />
                        )}
                      </div>

                      <div
                        className={cn(
                          "min-w-0 flex-1 space-y-2 transition-opacity duration-500",
                          isAssistant && !isLast && "opacity-45",
                          !isAssistant && "opacity-70",
                        )}
                      >
                        <div
                          className={cn(
                            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                            m.role === "user"
                              ? "border border-wj-green/25 bg-wj-green/15 text-foreground"
                              : "border border-border/25 bg-background/50 text-foreground",
                          )}
                        >
                          {m.content}
                        </div>
                        {isAssistant && (
                          <div className="flex flex-wrap items-center gap-2">
                            {m.source === "local" && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-wj-green/30 bg-wj-green/10 px-2 py-0.5 text-[10px] text-wj-green">
                                <Zap className="h-3 w-3" /> instant
                              </span>
                            )}
                            {m.action && (
                              <button
                                type="button"
                                onClick={() => handleAction(m.action!)}
                                className="rounded-full border border-wj-green/40 bg-wj-green/10 px-3 py-1 text-[11px] text-wj-green transition-colors hover:bg-wj-green/20"
                              >
                                {m.action.label}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <AnimatePresence>
                  {busy && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="relative flex gap-3"
                    >
                      <div className="relative z-10 flex w-[34px] shrink-0 justify-center pt-1.5">
                        {!orbInComposer && (
                          <motion.div layoutId="assistant-orb">
                            <AgentOrb
                              size={34}
                              state={status === "thinking" ? "thinking" : "speaking"}
                            />
                          </motion.div>
                        )}
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={thinkingPhrase || status}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.25 }}
                          className="pt-3 text-xs text-muted-foreground"
                        >
                          {thinkingPhrase || `${config.name} is answering...`}
                        </motion.p>
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {error && <p className="relative z-10 mt-3 text-xs text-destructive">{error}</p>}

        {/* Composer */}
        <div className="relative z-10 mt-5 rounded-2xl border border-border/30 bg-background/70 p-2">
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {orbInComposer && (
                <motion.div layoutId="assistant-orb" className="shrink-0 pl-1">
                  <AgentOrb
                    size={30}
                    state={
                      status === "thinking" ? "thinking" : status === "answering" ? "speaking" : "idle"
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
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

      <BikeDiagnosisDialog
        open={diagnosisOpen}
        onOpenChange={setDiagnosisOpen}
        initialSymptom={diagnosisSymptom}
      />
    </div>
  );
}