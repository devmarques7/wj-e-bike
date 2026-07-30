import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, RefreshCw, Settings2, Zap, Stethoscope, Wrench, Package, Tag, Bike, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBikeAssistant } from "@/hooks/useBikeAssistant";
import AssistantSettingsDialog from "./AssistantSettingsDialog";
import { AssistantIcon } from "./assistantIcons";
import { cn } from "@/lib/utils";
import AgentOrb from "@/components/agent/AgentOrb";
import RichText from "./RichText";
import { useAuth } from "@/contexts/AuthContext";
import type { AssistantAction } from "@/lib/ai/intents";

interface BikeAssistantCardProps {
  className?: string;
}


/** The assistant's priority flows, in the order we want riders to use them. */
const PRIORITY_ACTIONS = [
  { icon: Stethoscope, label: "Book a revision", prompt: "I want to book a revision for my bike", primary: true },
  { icon: Wrench, label: "My bike has a problem", prompt: "My bike is not working properly" },
  { icon: Package, label: "Find a part that fixes it", prompt: "Which part solves my problem?" },
  { icon: Tag, label: "Is it covered by my plan?", prompt: "Is this service covered by my plan?" },
  { icon: Bike, label: "Explore new bikes", prompt: "Which bike should I upgrade to?" },
];

/**
 * Splits an assistant reply into prose + the option lines it offered
 * (bullets, dashes or numbered items) so they can be rendered as chips.
 */
function parseOptions(content: string): { text: string; options: string[] } {
  const lines = content.split("\n");
  const options: string[] = [];
  const kept: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.{3,140})$/);
    if (match) {
      options.push(match[1].trim().replace(/^\*\*|\*\*$/g, ""));
    } else {
      kept.push(line);
    }
  }
  if (!options.length) return { text: content, options: [] };
  return { text: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(), options };
}

export default function BikeAssistantCard({ className }: BikeAssistantCardProps) {
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
    diagnosis,
    diagnosisProgress,
    removeDiagnosisTag,
    cancelDiagnosis,
  } = useBikeAssistant();
  const [value, setValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [openAnalysis, setOpenAnalysis] = useState<Record<string, boolean>>({});
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

  const handleAction = (action: AssistantAction) => runAction(action);
  const diagnosisActive = Boolean(diagnosis && diagnosis.phase !== "done");

  return (
    <div className={cn("relative overflow-hidden rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md h-full flex flex-col", className)}>

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

      <div className="relative flex-1 flex flex-col min-h-0 px-5 py-6">
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[220px] w-[420px] -translate-x-1/2 rounded-full bg-wj-green/10 blur-[90px]" />

        <div
          ref={scrollRef}
          className={cn(
            "relative z-10 flex-1 min-h-0 overflow-y-auto",
            messages.length > 0 &&
              "rounded-2xl border border-border/25 bg-muted/30 p-4 backdrop-blur-sm",
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
                  const parsed = isAssistant ? parseOptions(m.content) : { text: m.content, options: [] };
                  const chips = m.options?.length ? m.options : parsed.options;
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
                        {isAssistant && m.analysis ? (
                          <div className="rounded-2xl border border-border/25 bg-background/40">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenAnalysis((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                              }
                              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <span>Analysis of your description</span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 transition-transform",
                                  openAnalysis[m.id] && "rotate-180",
                                )}
                              />
                            </button>
                            {openAnalysis[m.id] && (
                              <div className="whitespace-pre-wrap border-t border-border/20 px-4 py-2.5 text-sm text-foreground">
                                <RichText text={parsed.text || m.content} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "whitespace-pre-wrap text-sm",
                              m.role === "user"
                                ? "px-1 py-1 text-foreground/80"
                                : "rounded-2xl border border-border/25 bg-background/40 px-4 py-2.5 text-foreground",
                            )}
                          >
                            <RichText text={parsed.text || m.content} />
                          </div>
                        )}
                        {isAssistant && chips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {chips.map((option, i) => (
                              <button
                                key={`${m.id}-opt-${i}`}
                                type="button"
                                onClick={() => submit(option)}
                                disabled={busy}
                                className="rounded-full border border-wj-green/30 bg-wj-green/5 px-3 py-1.5 text-left text-[11px] text-foreground/90 transition-colors hover:border-wj-green/60 hover:bg-wj-green/15 hover:text-wj-green disabled:opacity-50"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}
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
          {diagnosis && diagnosis.tags.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
              {diagnosis.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="group inline-flex max-w-full items-center gap-1 rounded-full border border-wj-green/40 bg-wj-green/10 py-1 pl-2.5 pr-1 text-[11px] text-wj-green"
                  title={tag.question}
                >
                  <span className="truncate">{tag.label}</span>
                  <button
                    type="button"
                    onClick={() => removeDiagnosisTag(tag.id)}
                    disabled={busy}
                    aria-label={`Remove answer ${tag.label}`}
                    className="rounded-full p-0.5 transition-colors hover:bg-wj-green/25 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {diagnosisActive && diagnosisProgress && (
                <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-muted-foreground">
                  diagnosis {diagnosisProgress.done}/{diagnosisProgress.total}
                  <button
                    type="button"
                    onClick={cancelDiagnosis}
                    className="underline underline-offset-2 transition-colors hover:text-foreground"
                  >
                    cancel
                  </button>
                </span>
              )}
            </div>
          )}
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
              placeholder={diagnosisActive ? "Tap an answer or type your own..." : "Ask whatever you want..."}
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