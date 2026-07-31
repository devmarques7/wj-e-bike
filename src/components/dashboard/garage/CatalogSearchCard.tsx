import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Minus, X, ShoppingBag, Package, Wrench, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCatalogSearch, useCustomerTargets, type CatalogHit } from "@/hooks/staff/useCatalogSearch";
import { cn } from "@/lib/utils";

type Line = CatalogHit & { qty: number };

const euro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const FILTERS = [
  { id: "all", label: "All" },
  { id: "product", label: "Parts & products" },
  { id: "service", label: "Services" },
] as const;

/** Workshop catalog search with a basket that can be addressed to a client/bike. */
export default function CatalogSearchCard({ className }: { className?: string }) {
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [bikeId, setBikeId] = useState<string>("");
  const [note, setNote] = useState("");

  const { hits, loading } = useCatalogSearch(term);
  const { customers, bikes } = useCustomerTargets();
  const { toast } = useToast();

  const results = useMemo(
    () => (filter === "all" ? hits : hits.filter((h) => h.kind === filter)),
    [hits, filter],
  );

  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const add = (hit: CatalogHit) =>
    setLines((prev) => {
      const found = prev.find((l) => l.key === hit.key);
      if (found) return prev.map((l) => (l.key === hit.key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { ...hit, qty: 1 }];
    });

  const setQty = (key: string, qty: number) =>
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l)),
    );

  const customerBikes = customerId ? bikes[customerId] ?? [] : [];

  const saveGroup = async () => {
    if (!customerId || lines.length === 0) return;
    setSaving(true);
    const bikeLabel = customerBikes.find((b) => b.id === bikeId)?.label;
    const body = [
      `**${groupName.trim() || "Parts basket"}**`,
      bikeLabel ? `Bike: ${bikeLabel}` : null,
      "",
      ...lines.map((l) => `- ${l.qty}× ${l.name}${l.sku ? ` (${l.sku})` : ""} — ${euro(l.price * l.qty)}`),
      "",
      `Total: ${euro(total)}`,
      note.trim() ? `\nNotes: ${note.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.rpc("fn_log_customer_note", {
      p_customer_id: customerId,
      p_content: body,
      p_note_type: "opportunity",
      p_is_pinned: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save the basket", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Basket assigned", description: "Saved to the customer profile." });
    setLines([]);
    setGroupName("");
    setNote("");
    setBikeId("");
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/20">
        <div>
          <p className="text-sm text-foreground">Catalog search</p>
          <p className="text-[11px] text-muted-foreground">Bikes, parts and services — build a basket</p>
        </div>
        <div className="relative">
          <ShoppingBag className="h-4 w-4 text-wj-green" />
          {lines.length > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-wj-green text-white text-[9px] font-bold flex items-center justify-center">
              {lines.reduce((s, l) => s + l.qty, 0)}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a bike, part, accessory or service…"
            className="pl-9 h-9 text-sm rounded-full bg-background/50"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1 text-[11px] rounded-full transition-colors",
                filter === f.id
                  ? "bg-wj-green text-white"
                  : "text-muted-foreground hover:text-foreground border border-border/30",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
        {results.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground py-6 text-center">No catalog items found.</p>
        )}
        {results.map((hit) => (
          <div
            key={hit.key}
            className="flex items-center gap-3 rounded-2xl border border-border/25 bg-background/40 px-3 py-2.5"
          >
            {hit.kind === "service" ? (
              <Wrench className="h-3.5 w-3.5 text-wj-green shrink-0" />
            ) : (
              <Package className="h-3.5 w-3.5 text-wj-green shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground truncate">{hit.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {hit.sku ? `${hit.sku} · ` : ""}
                {hit.subtitle}
                {hit.stock != null ? ` · ${hit.stock} in stock` : ""}
                {hit.location ? ` · ${hit.location}` : ""}
              </p>
            </div>
            <span className="text-xs text-foreground whitespace-nowrap">{euro(hit.price)}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => add(hit)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {lines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/20 bg-background/40"
          >
            <div className="max-h-40 overflow-y-auto px-4 py-3 space-y-2">
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-foreground truncate">{l.name}</p>
                    <p className="text-[10px] text-muted-foreground">{euro(l.price * l.qty)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQty(l.key, l.qty - 1)}
                      className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-[11px] text-foreground">{l.qty}</span>
                    <button
                      onClick={() => setQty(l.key, l.qty + 1)}
                      className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => setQty(l.key, 0)}
                    className="p-1 text-muted-foreground/50 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/20">
              <div>
                <p className="text-[10px] text-muted-foreground">Basket total</p>
                <p className="text-sm text-foreground">{euro(total)}</p>
              </div>
              <Button size="sm" className="rounded-full gap-2" onClick={() => setOpen(true)}>
                <Users className="h-3.5 w-3.5" />
                Assign to client
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign basket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Basket name (e.g. Brake overhaul kit)"
            />
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v);
                setBikeId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bikeId} onValueChange={setBikeId} disabled={customerBikes.length === 0}>
              <SelectTrigger>
                <SelectValue
                  placeholder={customerBikes.length ? "Select bike (optional)" : "No bikes registered"}
                />
              </SelectTrigger>
              <SelectContent>
                {customerBikes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes for the workshop or the client…"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              {lines.length} item{lines.length === 1 ? "" : "s"} · {euro(total)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveGroup} disabled={!customerId || saving}>
              {saving ? "Saving…" : "Save basket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
