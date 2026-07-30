import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSISTANT_ICONS, ASSISTANT_SKILLS, type AssistantConfig, type AssistantSkillId } from "@/lib/ai/skills";
import { AssistantIcon } from "./assistantIcons";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AssistantConfig;
  updateConfig: (patch: Partial<AssistantConfig>) => void;
  toggleSkill: (id: AssistantSkillId) => void;
}

export default function AssistantSettingsDialog({
  open,
  onOpenChange,
  config,
  updateConfig,
  toggleSkill,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assistant setup</DialogTitle>
          <DialogDescription>
            Identity, response flow and the skills the assistant can use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="space-y-2">
            <Label htmlFor="assistant-name">Name</Label>
            <Input
              id="assistant-name"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
              placeholder="E-IA"
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ASSISTANT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => updateConfig({ icon })}
                  className={cn(
                    "h-10 w-10 rounded-xl border flex items-center justify-center transition-colors",
                    config.icon === icon
                      ? "border-wj-green bg-wj-green/15 text-wj-green"
                      : "border-border/40 text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={icon}
                >
                  <AssistantIcon name={icon} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <Select
              value={config.tone}
              onValueChange={(v) => updateConfig({ tone: v as AssistantConfig["tone"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max response time</Label>
              <span className="text-xs text-muted-foreground">{config.maxResponseSeconds}s</span>
            </div>
            <Slider
              value={[config.maxResponseSeconds]}
              min={10}
              max={90}
              step={5}
              onValueChange={([v]) => updateConfig({ maxResponseSeconds: v })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Thinking animation</Label>
              <span className="text-xs text-muted-foreground">{config.thinkingMs}ms</span>
            </div>
            <Slider
              value={[config.thinkingMs]}
              min={0}
              max={3000}
              step={100}
              onValueChange={([v]) => updateConfig({ thinkingMs: v })}
            />
          </div>

          <div className="space-y-3">
            <Label>Skills</Label>
            <div className="space-y-2">
              {ASSISTANT_SKILLS.map((skill) => {
                const Icon = skill.icon;
                const enabled = config.enabledSkills.includes(skill.id);
                return (
                  <div
                    key={skill.id}
                    className="flex items-start gap-3 rounded-2xl border border-border/30 bg-background/40 p-3"
                  >
                    <div
                      className={cn(
                        "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center",
                        enabled ? "bg-wj-green/15 text-wj-green" : "bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{skill.name}</p>
                      <p className="text-xs text-muted-foreground">{skill.description}</p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={() => toggleSkill(skill.id)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}