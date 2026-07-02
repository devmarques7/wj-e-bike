import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, X, Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createPlan, createPlanVersion, updatePlan, type PlanWithActiveVersion } from "@/hooks/plans/usePlansData";

const PRESET_COLORS = [
  "#058c42", "#e8593c", "#60a5fa", "#a78bfa",
  "#f59e0b", "#34d399", "#f87171", "#94a3b8",
];

export default function PlanFormModal({
  open,
  onOpenChange,
  plan,
  onSaved,
  initialTab,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan?: PlanWithActiveVersion | null;
  onSaved: () => void;
  initialTab?: "single" | "bulk";
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(plan);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tier, setTier] = useState(1);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#058c42");
  const [price, setPrice] = useState(0);
  const [interval, setInterval] = useState<"monthly" | "quarterly" | "yearly" | "lifetime">("monthly");
  const [trial, setTrial] = useState(0);
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [unlimitedTrial, setUnlimitedTrial] = useState(false);
  const [urgentIncluded, setUrgentIncluded] = useState(true);
  const [urgentFee, setUrgentFee] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"single" | "bulk">(initialTab ?? "single");
  const [bulkText, setBulkText] = useState("");
  const [bulkFormat, setBulkFormat] = useState<"json" | "csv">("json");
  const [importing, setImporting] = useState(false);

  // Sync tab when the modal is re-opened with a different requested tab
  useEffect(() => {
    if (open) setTab(initialTab ?? "single");
  }, [open, initialTab]);

  const JSON_TEMPLATE = JSON.stringify(
    [
      {
        name: "Free",
        slug: "free",
        tier_level: 0,
        description: "View-only access.",
        color_hex: "#6b7280",
        icon: null,
        display_order: 0,
        is_active: true,
        is_default: true,
        price: 0,
        currency: "EUR",
        interval: "monthly",
        trial_days: 0,
        features: ["View dashboard", "View bike details"],
        urgent_service_included: true,
        urgent_service_fee: 100,
      },
      {
        name: "Plus",
        slug: "plus",
        tier_level: 2,
        description: "Includes priority service.",
        color_hex: "#058c42",
        icon: null,
        display_order: 2,
        is_active: true,
        is_default: false,
        price: 19.9,
        currency: "EUR",
        interval: "monthly",
        trial_days: 7,
        features: ["All Light features", "Priority booking"],
        urgent_service_included: true,
        urgent_service_fee: 0,
      },
      {
        name: "Black",
        slug: "black",
        tier_level: 3,
        description: "Full concierge experience with valet pick-up.",
        color_hex: "#111111",
        icon: null,
        display_order: 3,
        is_active: true,
        is_default: false,
        price: 199,
        currency: "EUR",
        interval: "yearly",
        trial_days: -1,
        features: [
          "All Plus features",
          "Valet pick-up & drop-off",
          "Unlimited urgent service",
        ],
        urgent_service_included: true,
        urgent_service_fee: 0,
      },
    ],
    null,
    2
  );

  const CSV_TEMPLATE =
    "name,slug,tier_level,description,color_hex,icon,display_order,is_active,is_default,price,currency,interval,trial_days,features,urgent_service_included,urgent_service_fee\n" +
    'Free,free,0,View-only access.,#6b7280,,0,true,true,0,EUR,monthly,0,"View dashboard|View bike details",true,100\n' +
    'Plus,plus,2,Includes priority service.,#058c42,,2,true,false,19.90,EUR,monthly,7,"All Light features|Priority booking",true,0\n' +
    'Black,black,3,Full concierge experience.,#111111,,3,true,false,199,EUR,yearly,-1,"All Plus features|Valet pick-up|Unlimited urgent service",true,0\n';

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): any[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const split = (l: string) => {
      const out: string[] = [];
      let cur = "", q = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') { q = !q; continue; }
        if (c === "," && !q) { out.push(cur); cur = ""; continue; }
        cur += c;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const toBool = (v: any) => {
      if (typeof v === "boolean") return v;
      const s = String(v ?? "").trim().toLowerCase();
      return s === "true" || s === "1" || s === "yes" || s === "y";
    };
    const headers = split(lines[0]);
    return lines.slice(1).filter(Boolean).map((l) => {
      const cells = split(l);
      const o: any = {};
      headers.forEach((h, i) => (o[h] = cells[i]));
      o.tier_level = Number(o.tier_level ?? 0);
      o.display_order = o.display_order === undefined || o.display_order === ""
        ? Number(o.tier_level ?? 0)
        : Number(o.display_order);
      o.price = Number(o.price ?? 0);
      o.trial_days = Number(o.trial_days ?? 0);
      o.features = (o.features ?? "").split("|").map((s: string) => s.trim()).filter(Boolean);
      if (o.is_active !== undefined) o.is_active = toBool(o.is_active);
      if (o.is_default !== undefined) o.is_default = toBool(o.is_default);
      if (o.urgent_service_included !== undefined)
        o.urgent_service_included = toBool(o.urgent_service_included);
      if (o.urgent_service_fee !== undefined && o.urgent_service_fee !== "")
        o.urgent_service_fee = Number(o.urgent_service_fee);
      if (o.icon === "") o.icon = null;
      return o;
    });
  };

  const runImport = async () => {
    if (!bulkText.trim()) { toast.error(t("plans.form.bulk.paste_first")); return; }
    let rows: any[] = [];
    try {
      rows = bulkFormat === "json" ? JSON.parse(bulkText) : parseCsv(bulkText);
      if (!Array.isArray(rows)) throw new Error("Expected an array");
    } catch (e: any) {
      toast.error(t("plans.form.bulk.parse_error", { message: e.message }));
      return;
    }
    setImporting(true);
    let ok = 0, fail = 0;
    // Normalise alternate field names (level/color_accent/monthly_price/annual_price/benefits)
    const normalize = (raw: any) => {
      const r = { ...raw };
      if (r.tier_level === undefined && r.level !== undefined) r.tier_level = r.level;
      if (r.color_hex === undefined && r.color_accent !== undefined) r.color_hex = r.color_accent;
      if (r.price === undefined) {
        if (r.monthly_price !== undefined && r.monthly_price !== null) {
          r.price = r.monthly_price;
          if (r.interval === undefined) r.interval = "monthly";
        } else if (r.annual_price !== undefined && r.annual_price !== null) {
          r.price = r.annual_price;
          if (r.interval === undefined) r.interval = "yearly";
        }
      }
      if (!Array.isArray(r.features)) {
        if (Array.isArray(r.benefits)) {
          r.features = r.benefits
            .map((b: any) => b?.name_en || b?.name || b?.label || b?.value?.text_en)
            .filter(Boolean);
        } else {
          r.features = [];
        }
      }
      return r;
    };
    for (const raw of rows) {
      const r = normalize(raw);
      try {
        if (!r.name || !r.slug) throw new Error("name and slug required");
        const { data, error } = await createPlan({
          name: r.name,
          slug: String(r.slug).toLowerCase(),
          tier_level: Number(r.tier_level ?? 0),
          description: r.description ?? "",
          color_hex: r.color_hex ?? "#058c42",
          display_order: Number(
            r.display_order ?? r.tier_level ?? 0,
          ),
          is_default: r.is_default === true,
          ...(r.icon !== undefined ? { icon: r.icon } : {}),
          ...(r.is_active === false ? { is_active: false } : {}),
        } as any);
        if (error) throw error;
        const { error: e2 } = await createPlanVersion({
          p_plan_id: data!.id,
          p_price: Number(r.price ?? 0),
          p_currency: r.currency ?? "EUR",
          p_interval: (r.interval ?? "monthly") as any,
          p_trial_days: Number(r.trial_days ?? 0),
          p_features: Array.isArray(r.features) ? r.features : [],
          p_activate: true,
          p_urgent_service_included:
            r.urgent_service_included === undefined
              ? true
              : Boolean(r.urgent_service_included),
          p_urgent_service_fee:
            r.urgent_service_fee === undefined
              ? 0
              : Number(r.urgent_service_fee),
        });
        if (e2) throw e2;
        ok++;
      } catch (e: any) {
        fail++;
        console.error("Import row failed:", r, e.message);
      }
    }
    setImporting(false);
    toast.success(
      (ok === 1 ? t("plans.form.bulk.imported_one", { n: ok }) : t("plans.form.bulk.imported_other", { n: ok })) +
      (fail ? String(t("plans.form.bulk.with_failures", { n: fail })) : "")
    );
    if (ok > 0) { onSaved(); onOpenChange(false); setBulkText(""); }
  };

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setSlug(plan.slug);
      setTier(plan.tier_level);
      setDescription(plan.description ?? "");
      setColor(plan.color_hex ?? "#058c42");
      setPrice(Number(plan.activeVersion?.price ?? 0));
      setInterval((plan.activeVersion?.interval ?? "monthly") as any);
      const td = plan.activeVersion?.trial_days ?? 0;
      setUnlimitedTrial(td === -1);
      setTrial(td === -1 ? 0 : td);
      setFeatures(plan.activeVersion?.features ?? []);
      setIsDefault(Boolean((plan as any).is_default));
      setUrgentIncluded(plan.activeVersion?.urgent_service_included ?? true);
      setUrgentFee(Number(plan.activeVersion?.urgent_service_fee ?? 0));
    } else {
      setName(""); setSlug(""); setTier(1); setDescription(""); setColor("#058c42");
      setPrice(0); setInterval("monthly"); setTrial(0); setFeatures([]);
      setIsDefault(false); setUnlimitedTrial(false);
      setUrgentIncluded(true);
      setUrgentFee(0);
    }
  }, [plan, open]);

  const save = async () => {
    if (!name || !slug) {
      toast.error(t("plans.form.name_slug_required"));
      return;
    }
    setSaving(true);
    try {
      let planId = plan?.id;
      if (isEdit && planId) {
        await updatePlan(planId, { name, slug, tier_level: tier, description, color_hex: color, is_default: isDefault } as any);
      } else {
        const { data, error } = await createPlan({ name, slug, tier_level: tier, description, color_hex: color, display_order: tier, is_default: isDefault });
        if (error) throw error;
        planId = data!.id;
      }
      const effectiveTrial = unlimitedTrial ? -1 : trial;
      const priceChanged =
        !plan?.activeVersion ||
        Number(plan.activeVersion.price) !== Number(price) ||
        plan.activeVersion.interval !== interval ||
        plan.activeVersion.trial_days !== effectiveTrial ||
        JSON.stringify(plan.activeVersion.features) !== JSON.stringify(features) ||
        Boolean(plan.activeVersion.urgent_service_included) !== urgentIncluded ||
        Number(plan.activeVersion.urgent_service_fee ?? 0) !== Number(urgentFee);
      if (priceChanged && planId) {
        const { error } = await createPlanVersion({
          p_plan_id: planId,
          p_price: price,
          p_interval: interval,
          p_trial_days: effectiveTrial,
          p_features: features,
          p_activate: true,
          p_urgent_service_included: urgentIncluded,
          p_urgent_service_fee: urgentIncluded ? Number(urgentFee) : 0,
        });
        if (error) throw error;
      }
      toast.success(isEdit ? t("plans.form.updated") : t("plans.form.created"));
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? t("plans.form.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-light text-xl">{isEdit ? t("plans.form.edit_plan", { name: plan?.name }) : t("plans.form.new_plan")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("plans.form.edit_desc") : t("plans.form.new_desc")}
          </DialogDescription>
        </DialogHeader>

        {!isEdit && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-2">
            <TabsList className="bg-transparent border-b border-border/30 rounded-none p-0 h-auto w-full justify-start gap-1">
              <TabsTrigger value="single" className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-xs data-[state=active]:border-wj-green data-[state=active]:bg-transparent data-[state=active]:shadow-none">{t("plans.form.tabs.single")}</TabsTrigger>
              <TabsTrigger value="bulk" className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-xs data-[state=active]:border-wj-green data-[state=active]:bg-transparent data-[state=active]:shadow-none">{t("plans.form.tabs.bulk")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {(isEdit || tab === "single") && (
        <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("plans.form.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plus" />
          </div>
          <div>
            <Label>{t("plans.form.slug")}</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="plus" disabled={isEdit} />
          </div>
          <div>
            <Label>{t("plans.form.tier_level")}</Label>
            <Input type="number" value={tier} onChange={(e) => setTier(Number(e.target.value))} />
          </div>
          <div>
            <Label>{t("plans.form.color")}</Label>
            <div className="flex gap-1.5 mt-2 items-center flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Select color ${c}`}
                  className={`h-6 w-6 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
              <label className="relative h-6 w-6 rounded-full border border-dashed border-border/60 grid place-items-center cursor-pointer overflow-hidden" title="Custom color">
                <span className="text-[10px] text-muted-foreground">+</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <span className="ml-1 text-[10px] text-muted-foreground font-mono">{color}</span>
            </div>
          </div>
          <div className="col-span-2">
            <Label>{t("plans.form.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="col-span-2 flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
            <div className="pr-4">
              <Label className="text-xs">{t("plans.form.default_label")}</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("plans.form.default_hint")}</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <div>
            <Label>{t("plans.form.price")}</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <Label>{t("plans.form.interval")}</Label>
            <Select value={interval} onValueChange={(v) => setInterval(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t("plans.intervals.monthly")}</SelectItem>
                <SelectItem value="quarterly">{t("plans.intervals.quarterly")}</SelectItem>
                <SelectItem value="yearly">{t("plans.intervals.yearly")}</SelectItem>
                <SelectItem value="lifetime">{t("plans.intervals.lifetime")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>{t("plans.form.trial")}</Label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlimitedTrial}
                  onChange={(e) => setUnlimitedTrial(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border/50 accent-wj-green"
                />
                <span className="text-[11px] text-muted-foreground">{t("plans.form.unlimited")}</span>
              </label>
            </div>
            <Input
              type="number"
              value={unlimitedTrial ? "" : trial}
              disabled={unlimitedTrial}
              onChange={(e) => setTrial(Number(e.target.value))}
              placeholder={unlimitedTrial ? String(t("plans.form.unlimited")) : "0"}
            />
          </div>

          <div className="col-span-2">
            <Label>{t("plans.form.features")}</Label>
            <div className="flex gap-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder={String(t("plans.form.add_feature"))}
                onKeyDown={(e) => { if (e.key === "Enter" && newFeature.trim()) { setFeatures([...features, newFeature.trim()]); setNewFeature(""); } }}
              />
              <Button type="button" size="icon" variant="outline" onClick={() => { if (newFeature.trim()) { setFeatures([...features, newFeature.trim()]); setNewFeature(""); } }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {features.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/40 rounded px-3 py-1.5 text-sm">
                  <span>{f}</span>
                  <button onClick={() => setFeatures(features.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2 rounded-lg border border-border/40 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <Label className="text-xs">Urgent service included</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  All plans include access to urgent service. Set a per-visit fee for lower tiers (e.g. €100 for Free).
                </p>
              </div>
              <Switch checked={urgentIncluded} onCheckedChange={setUrgentIncluded} />
            </div>
            {urgentIncluded && (
              <div>
                <Label className="text-xs">Urgent service fee (€ / visit)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={urgentFee}
                  onChange={(e) => setUrgentFee(Number(e.target.value))}
                  placeholder="0 = free for this plan"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("plans.form.cancel")}</Button>
          <Button onClick={save} disabled={saving} className="bg-wj-green hover:bg-wj-green/90">
            {saving ? t("plans.form.saving") : isEdit ? t("plans.form.save_version") : t("plans.form.create")}
          </Button>
        </div>
        </>
        )}

        {!isEdit && tab === "bulk" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-md border border-border/40 overflow-hidden">
                <button type="button" onClick={() => setBulkFormat("json")} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 ${bulkFormat === "json" ? "bg-wj-green/10 text-wj-green" : "text-muted-foreground hover:text-foreground"}`}>
                  <FileJson className="h-3.5 w-3.5" /> {t("plans.form.bulk.json")}
                </button>
                <button type="button" onClick={() => setBulkFormat("csv")} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-border/40 ${bulkFormat === "csv" ? "bg-wj-green/10 text-wj-green" : "text-muted-foreground hover:text-foreground"}`}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> {t("plans.form.bulk.csv")}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBulkText(bulkFormat === "json" ? JSON_TEMPLATE : CSV_TEMPLATE)}>
                  {t("plans.form.bulk.view_template")}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => downloadFile(
                  bulkFormat === "json" ? JSON_TEMPLATE : CSV_TEMPLATE,
                  bulkFormat === "json" ? "plans-template.json" : "plans-template.csv",
                  bulkFormat === "json" ? "application/json" : "text/csv",
                )}>
                  <Download className="h-3.5 w-3.5 mr-1" /> {t("plans.form.bulk.download")}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border/30 bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{t("plans.form.bulk.expected_fields")}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Plano:</strong>{" "}
                <code className="text-foreground">name</code>, <code className="text-foreground">slug</code>, <code className="text-foreground">tier_level</code>, <code className="text-foreground">description</code>, <code className="text-foreground">color_hex</code>, <code className="text-foreground">icon</code>, <code className="text-foreground">display_order</code>, <code className="text-foreground">is_active</code>, <code className="text-foreground">is_default</code>.
                <br />
                <strong className="text-foreground">Versão / preço:</strong>{" "}
                <code className="text-foreground">price</code>, <code className="text-foreground">currency</code> (EUR), <code className="text-foreground">interval</code> (monthly/quarterly/yearly/lifetime), <code className="text-foreground">trial_days</code> (-1 = ilimitado), <code className="text-foreground">features</code>{" "}
                {bulkFormat === "csv" ? <>(separado por <code className="text-foreground">|</code>)</> : <>(array de strings)</>}, <code className="text-foreground">urgent_service_included</code>, <code className="text-foreground">urgent_service_fee</code>.
                <br />
                <span className="text-[11px]">Apenas <code className="text-foreground">name</code> e <code className="text-foreground">slug</code> são obrigatórios — os restantes usam os defaults quando omitidos.</span>
              </p>
            </div>

            <div>
              <Label className="text-xs">{t("plans.form.bulk.paste", { format: bulkFormat.toUpperCase() })}</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={bulkFormat === "json" ? "[ { …plan… }, … ]" : "name,slug,tier_level,…"}
                rows={12}
                className="font-mono text-xs mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t("plans.form.cancel")}</Button>
              <Button onClick={runImport} disabled={importing} className="bg-wj-green hover:bg-wj-green/90">
                {importing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> {t("plans.form.bulk.importing")}</> : t("plans.form.bulk.import_btn")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}