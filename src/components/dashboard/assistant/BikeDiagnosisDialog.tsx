import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ClipboardList, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SYMPTOMS,
  buildBriefing,
  getSymptom,
  saveBriefing,
  type RepairBriefing,
  type SymptomDefinition,
  type SymptomId,
} from "@/lib/ai/diagnosis";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected symptom (when the assistant already understood the problem). */
  initialSymptom?: SymptomId | null;
}

export default function BikeDiagnosisDialog({ open, onOpenChange, initialSymptom }: Props) {
  const navigate = useNavigate();
  const [symptom, setSymptom] = useState<SymptomDefinition | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [notes, setNotes] = useState("");
  const [briefing, setBriefing] = useState<RepairBriefing | null>(null);

  useEffect(() => {
    if (!open) return;
    setSymptom(initialSymptom ? getSymptom(initialSymptom) : null);
    setStep(0);
    setAnswers({});
    setFreeText("");
    setNotes("");
    setBriefing(null);
  }, [open, initialSymptom]);

  const questions = symptom?.questions ?? [];
  const question = questions[step] ?? null;
  const totalSteps = questions.length + 1; // + notes/review step

  const answerList = useMemo(
    () =>
      questions
        .filter((q) => answers[q.id])
        .map((q) => ({ question: q.question, answer: answers[q.id] })),
    [questions, answers],
  );

  const answer = (value: string) => {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    setFreeText("");
    setStep((s) => s + 1);
  };

  const finish = () => {
    if (!symptom) return;
    const result = buildBriefing(symptom, answerList, notes.trim());
    saveBriefing(result);
    setBriefing(result);
  };

  const goToBooking = () => {
    onOpenChange(false);
    navigate("/dashboard/service", { state: { briefing } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-wj-green" />
            {briefing ? "Repair briefing ready" : "Let's diagnose your bike"}
          </DialogTitle>
          <DialogDescription>
            {briefing
              ? "Attach it to a revision appointment — the mechanic sees it before you arrive."
              : "A few quick questions build a complete briefing for the WJ workshop."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — symptom */}
        {!symptom && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SYMPTOMS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSymptom(s)}
                className="rounded-2xl border border-border/40 bg-muted/40 p-3 text-left transition-colors hover:border-wj-green/40 hover:bg-wj-green/10"
              >
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — questions */}
        {symptom && !briefing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => (step === 0 ? setSymptom(null) : setStep((s) => s - 1))}
              >
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <span className="text-xs text-muted-foreground">
                {symptom.label} · step {Math.min(step + 1, totalSteps)}/{totalSteps}
              </span>
            </div>

            {step === 0 && symptom.quickChecks.length > 0 && (
              <div className="rounded-2xl border border-wj-green/25 bg-wj-green/5 p-3">
                <p className="text-xs font-medium text-wj-green">Try this first</p>
                <ul className="mt-1 space-y-1">
                  {symptom.quickChecks.map((c) => (
                    <li key={c} className="text-xs text-muted-foreground">· {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {question ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{question.question}</p>
                <div className="flex flex-wrap gap-2">
                  {question.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => answer(opt)}
                      className={cn(
                        "rounded-full border border-border/40 px-3 py-1.5 text-xs transition-colors",
                        "hover:border-wj-green/50 hover:bg-wj-green/10 hover:text-wj-green",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {question.allowFreeText && (
                  <div className="flex gap-2">
                    <Input
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="Describe it..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && freeText.trim()) answer(freeText.trim());
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={!freeText.trim()}
                      onClick={() => answer(freeText.trim())}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Anything else the mechanic should know?</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes, sounds, conditions..."
                  rows={3}
                />
                <Button className="w-full bg-wj-green text-white hover:bg-wj-green/90" onClick={finish}>
                  Generate repair briefing
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — briefing */}
        {briefing && (
          <div className="space-y-3">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-border/30 bg-black/40 p-3 text-xs text-foreground">
              {briefing.summary}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1 bg-wj-green text-white hover:bg-wj-green/90"
                onClick={goToBooking}
              >
                <Check className="mr-2 h-4 w-4" /> Book the revision
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(briefing.summary);
                  toast.success("Briefing copied");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}