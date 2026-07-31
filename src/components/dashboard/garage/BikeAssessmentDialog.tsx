import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  onSaved?: () => void;
}

type Bubble = { id: string; role: "bot" | "user"; text: string };

/**
 * Guided condition assessment — an AI-chat style questionnaire where the
 * technician answers one wear point at a time. The result is scored honestly
 * (non-new parts capped at 80%) and stored against the bike.
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const done = step >= ASSESSMENT_QUESTIONS.length;
  const question = done ? null : ASSESSMENT_QUESTIONS[step];
  const result = useMemo(() => computeAssessment(answers), [answers]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAnswers({});
    setNotes("");
    setBubbles([
      {
        id: "intro",
        role: "bot",
        text: `Quick condition assessment for ${bikeModel ?? "this bike"}. Six questions — answer what you see on the stand.`,
      },
      { id: "q0", role: "bot", text: ASSESSMENT_QUESTIONS[0].question },
    ]);
  }, [open, bikeModel]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, done]);

  const answer = (key: AssessmentKey, optionId: string, label: string) => {
    const next = { ...answers, [key]: optionId };
    setAnswers(next);
    const nextStep = step + 1;
    const nextQuestion = ASSESSMENT_QUESTIONS[nextStep];
    setBubbles((b) => [
      ...b,
      { id: `${key}-a`, role: "user", text: label },
      ...(nextQuestion
        ? [{ id: `q${nextStep}`, role: "bot" as const, text: nextQuestion.question }]
        : [
            {
              id: "summary",
              role: "bot" as const,
              text: "All points checked. Review the result and confirm to register it on this bike.",
            },
          ]),
    ]);
    setStep(nextStep);
  };

  const back = () => {
    if (step === 0) return;
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
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border-border/40 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-light">
            <Sparkles className="h-4 w-4 text-wj-green" /> Assess bike condition
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
            {bubbles.map((b) => (
              <motion.div
                key={b.id + b.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={b.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
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

          {done && (
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

        {question ? (
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