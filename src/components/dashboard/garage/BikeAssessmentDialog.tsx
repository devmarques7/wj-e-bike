import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AgentOrb from "@/components/agent/AgentOrb";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ASSESSMENT_QUESTIONS,
  computeAssessment,
  type AssessmentAnswers,
  type AssessmentKey,
} from "@/lib/garage/assessment";
import { useBikeAssessment } from "@/hooks/garage/useBikeAssessment";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bikeId: string;
  bikeModel?: string | null;
  customerId?: string | null;
  /** Receives the final validated condition (used to award E-Pass points). */
  onSaved?: (result: { overall: number; label: string }) => void;
}

type Bubble = { id: string; role: "bot" | "user"; text: string };

/** Local, zero-token "thinking" beats so the flow reads like a real assistant. */
const THINKING_LINES = [
  "Logging that point...",
  "Weighing wear against the cap...",
  "Updating the condition score...",
  "Checking the next wear point...",
];
const THINK_MS = 520;

/**
 * Guided condition assessment — a validation conversation with the WJ agent.
 * Runs fully offline (deterministic script, no model tokens): the orb + typing
 * beats only simulate the assistant while the technician answers one wear point
 * at a time. Scoring is honest (non-new parts capped) and stored on the bike.
 */
export default function BikeAssessmentDialog({
  open,
  onOpenChange,
  bikeId,
  bikeModel,
  customerId,
  onSaved,
}: Props) {
  const { save, saving } = useBikeAssessment(bikeId, customerId);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [notes, setNotes] = useState("");
  const [thinking, setThinking] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const done = step >= ASSESSMENT_QUESTIONS.length;
  const question = done ? null : ASSESSMENT_QUESTIONS[step];
  const result = useMemo(() => computeAssessment(answers), [answers]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAnswers({});
    setNotes("");
    setThinking(null);
    setBubbles([
      {
        id: "intro",
        role: "bot",
        text: `I'll validate the condition of ${bikeModel ?? "this bike"} with you. Six quick checks — answer what you see on the stand.`,
      },
      { id: "q0", role: "bot", text: ASSESSMENT_QUESTIONS[0].question },
    ]);
  }, [open, bikeModel]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, done, thinking]);

  const answer = (key: AssessmentKey, optionId: string, label: string) => {
    if (thinking) return;
    const next = { ...answers, [key]: optionId };
    setAnswers(next);
    const nextStep = step + 1;
    const nextQuestion = ASSESSMENT_QUESTIONS[nextStep];
    setBubbles((b) => [...b, { id: `${key}-a`, role: "user", text: label }]);
    setStep(nextStep);
    setThinking(THINKING_LINES[nextStep % THINKING_LINES.length]);
    timerRef.current = window.setTimeout(() => {
      setThinking(null);
      setBubbles((b) => [
        ...b,
        nextQuestion
          ? { id: `q${nextStep}`, role: "bot" as const, text: nextQuestion.question }
          : {
              id: "summary",
              role: "bot" as const,
              text: "All points checked. Here's the condition I calculated — confirm to register it on this bike.",
            },
      ]);
    }, THINK_MS);
  };

  const back = () => {
    if (step === 0) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setThinking(null);
    const prev = ASSESSMENT_QUESTIONS[step - 1];
    const next = { ...answers };
    delete next[prev.key];
    setAnswers(next);
    setStep(step - 1);
    setBubbles((b) => b.slice(0, Math.max(2, b.length - 2)));
  };

  const confirm = async () => {
    const res = await save(answers, notes);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Condition registered — ${result.overall}% (${result.label})`);
    onSaved?.({ overall: result.overall, label: result.label });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border-border/40 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-light">
            <AgentOrb size={26} state={thinking ? "thinking" : "idle"} /> Assess bike condition
          </DialogTitle>
        </DialogHeader>

        {/* progress */}
        <div className="flex gap-1">
          {ASSESSMENT_QUESTIONS.map((q, i) => (
            <span
              key={q.key}
              className={`h-[3px] flex-1 rounded-full ${i < step ? "bg-wj-green" : "bg-muted-foreground/20"}`}
            />
          ))}
        </div>

        <div ref={scrollRef} className="max-h-[42vh] overflow-y-auto space-y-3 pr-1">
          <AnimatePresence initial={false}>
            {bubbles.map((b, i) => (
              <motion.div
                key={b.id + b.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-2", b.role === "user" ? "justify-end" : "justify-start")}
              >
                {b.role === "bot" && (
                  <span className="relative flex w-[26px] shrink-0 justify-center pt-1">
                    {!thinking && i === bubbles.length - 1 ? (
                      <motion.span layoutId="assess-orb">
                        <AgentOrb size={26} state="speaking" />
                      </motion.span>
                    ) : (
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-wj-green/50" />
                    )}
                  </span>
                )}
                <p
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    b.role === "user"
                      ? "bg-wj-green/15 text-foreground border border-wj-green/30"
                      : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {b.text}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Assistant "typing" beat — purely local, no model call. */}
          <AnimatePresence>
            {thinking && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <motion.span layoutId="assess-orb" className="flex w-[26px] shrink-0 justify-center">
                  <AgentOrb size={26} state="thinking" />
                </motion.span>
                <span className="text-xs text-muted-foreground">{thinking}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {done && !thinking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-wj-green/30 bg-wj-green/5 p-4"
            >
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Overall condition
              </p>
              <p className="text-4xl font-light text-foreground tabular-nums">
                {result.overall}
                <span className="text-base text-muted-foreground">%</span>
              </p>
              <p className="text-xs text-wj-green">{result.label}</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                {ASSESSMENT_QUESTIONS.filter((q) => q.key !== "origin").map((q) => (
                  <span key={q.key} className="flex justify-between gap-2">
                    {q.label}
                    <span className="tabular-nums text-foreground">{result.scores[q.key] ?? 0}%</span>
                  </span>
                ))}
              </div>
              {result.cap < 100 && (
                <p className="mt-2 text-[10px] text-muted-foreground/80">
                  Second-hand / refurbished bike — every point capped at {result.cap}%.
                </p>
              )}
            </motion.div>
          )}
        </div>

        {thinking ? null : question ? (
          <div className="space-y-2">
            {question.options.map((o) => (
              <button
                key={o.id}
                onClick={() => answer(question.key, o.id, o.label)}
                className="w-full rounded-2xl border border-border/40 bg-background/60 px-4 py-2.5 text-left transition-colors hover:border-wj-green/50 hover:bg-wj-green/5"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{o.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{o.score}%</span>
                </span>
                {o.hint && <span className="block text-[10px] text-muted-foreground/70">{o.hint}</span>}
              </button>
            ))}
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={back} className="text-xs text-muted-foreground">
                Back
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Workshop notes (optional)"
              className="rounded-2xl text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={back} className="text-xs">
                Back
              </Button>
              <Button onClick={confirm} disabled={saving} className="flex-1 rounded-full">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Confirm & register
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}