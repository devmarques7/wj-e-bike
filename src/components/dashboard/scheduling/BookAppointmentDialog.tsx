import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Bike, CalendarDays, Clock, UserCheck, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { isSlotSelectable } from "@/lib/scheduling/availability";
import { describeSchedulingError } from "@/lib/scheduling/availabilityGuard";
import { useSchedulingAvailability } from "@/contexts/SchedulingAvailabilityContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ServiceType } from "@/hooks/scheduling/useSchedulingData";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type Customer = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

type BikeModel = {
  id: string;
  name: string;
  color_hex: string | null;
  short_description: string | null;
};

type CustomerBike = {
  id: string;
  model: string;
  serial: string | null;
  color: string | null;
};

type Slot = {
  start: string; // "HH:MM"
  end: string;
  mechanicId: string;
  mechanicName: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serviceTypes?: ServiceType[];
  onCreated?: () => void;
  /** When provided, skips the customer/bike search step and locks selection. */
  presetCustomer?: { user_id: string; full_name?: string | null; email?: string | null };
  presetBike?: { model?: string | null; serial?: string | null };
  /** Optional initial notes prefix (e.g. context from caller). */
  initialNotes?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/* ------------------------------------------------------------------ */

export default function BookAppointmentDialog({
  open,
  onOpenChange,
  serviceTypes: serviceTypesProp,
  onCreated,
  presetCustomer,
  presetBike,
  initialNotes,
}: Props) {
  const hasPreset = !!presetCustomer;
  const [step, setStep] = useState<1 | 2 | 3>(hasPreset ? 2 : 1);
  const [fetchedServiceTypes, setFetchedServiceTypes] = useState<ServiceType[]>([]);
  const serviceTypes: ServiceType[] = serviceTypesProp ?? fetchedServiceTypes;

  // Customer
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Bike info
  const [bikeModel, setBikeModel] = useState("");
  const [bikeSerial, setBikeSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [bikeModels, setBikeModels] = useState<BikeModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [customerBikes, setCustomerBikes] = useState<CustomerBike[]>([]);
  const [customerBikesLoading, setCustomerBikesLoading] = useState(false);

  // Service & date
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [slot, setSlot] = useState<Slot | null>(null);

  // Availability
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [mechanicsList, setMechanicsList] = useState<{ id: string; name: string }[]>([]);
  const [mechanicFilter, setMechanicFilter] = useState<string>("any");

  // Calendar availability hints (for step 3)
  const [closedDows, setClosedDows] = useState<Set<number>>(new Set());
  const [forcedClosedDates, setForcedClosedDates] = useState<Set<string>>(new Set());
  const [forcedOpenDates, setForcedOpenDates] = useState<Set<string>>(new Set());

  // Global availability cycle (shared with the DB guard)
  const { user } = useAuth();
  const { version, getAvailability, ensureAvailability } = useSchedulingAvailability();
  const isWorkshopUser = user?.role === "staff" || user?.role === "admin";
  const [myDayOff, setMyDayOff] = useState(false);
  const [openingDay, setOpeningDay] = useState(false);

  const selectedService = useMemo(
    () => serviceTypes.find((s) => s.id === serviceId) ?? null,
    [serviceTypes, serviceId],
  );

  /* ---------- reset on close ---------- */
  useEffect(() => {
    if (!open) {
      setStep(hasPreset ? 2 : 1);
      setSearch("");
      setCustomers([]);
      setCustomer(null);
      setBikeModel("");
      setBikeSerial("");
      setCustomerBikes([]);
      setNotes("");
      setServiceId("");
      setDate(todayISO());
      setSlot(null);
      setSlots([]);
    } else if (hasPreset) {
      // Seed preset selections when opening
      setCustomer({
        user_id: presetCustomer!.user_id,
        full_name: presetCustomer!.full_name ?? null,
        email: presetCustomer!.email ?? null,
      });
      if (presetBike?.model) setBikeModel(presetBike.model);
      if (presetBike?.serial) setBikeSerial(presetBike.serial);
      if (initialNotes) setNotes(initialNotes);
      setStep(2);
    }
  }, [open, hasPreset, presetCustomer, presetBike, initialNotes]);

  /* ---------- fetch service types if not provided ---------- */
  useEffect(() => {
    if (!open || serviceTypesProp) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("service_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (cancelled) return;
      setFetchedServiceTypes((data ?? []) as any as ServiceType[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, serviceTypesProp]);

  /* ---------- bike models (catalog) ---------- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, color_hex, short_description")
        .eq("product_type", "bike")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(50);
      if (cancelled) return;
      if (!error) setBikeModels((data ?? []) as BikeModel[]);
      setModelsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* ---------- bikes of selected customer ---------- */
  useEffect(() => {
    if (!customer) {
      setCustomerBikes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setCustomerBikesLoading(true);
      const { data: cps } = await supabase
        .from("customer_profiles")
        .select("id")
        .eq("user_id", customer.user_id);
      const ids = (cps ?? []).map((c: any) => c.id);
      if (ids.length === 0) {
        if (!cancelled) {
          setCustomerBikes([]);
          setCustomerBikesLoading(false);
        }
        return;
      }
      const { data: bikes } = await supabase
        .from("customer_bikes")
        .select("id, model, serial, color")
        .in("customer_id", ids)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setCustomerBikes((bikes ?? []) as CustomerBike[]);
      setCustomerBikesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [customer]);

  /* ---------- customer search ---------- */
  // Preload all users that have at least one registered bike when the dialog opens
  useEffect(() => {
    if (!open || step !== 1) return;
    let cancelled = false;
    (async () => {
      setSearching(true);
      const { data: bikes } = await supabase
        .from("customer_bikes")
        .select("customer_id");
      const customerIds = Array.from(
        new Set((bikes ?? []).map((b: any) => b.customer_id).filter(Boolean)),
      );
      if (customerIds.length === 0) {
        if (!cancelled) {
          setCustomers([]);
          setSearching(false);
        }
        return;
      }
      const { data: cps } = await supabase
        .from("customer_profiles")
        .select("user_id")
        .in("id", customerIds);
      const userIds = Array.from(
        new Set((cps ?? []).map((c: any) => c.user_id).filter(Boolean)),
      );
      if (userIds.length === 0) {
        if (!cancelled) {
          setCustomers([]);
          setSearching(false);
        }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds)
        .order("full_name", { ascending: true });
      if (cancelled) return;
      setCustomers((profs ?? []) as Customer[]);
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step]);

  // Refine via DB search only when the user actually types something
  useEffect(() => {
    if (!open || step !== 1) return;
    const term = search.trim();
    if (term.length < 2) return; // keep the preloaded "bike owners" list
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(8);
      if (cancelled) return;
      if (!error) setCustomers((data ?? []) as Customer[]);
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, open, step]);

  /* ---------- availability ---------- */
  const computeSlots = useCallback(async () => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setSlot(null);
    try {
      // Use SECURITY DEFINER RPC so customers (not just admin/staff) get
      // real availability without hitting privacy-restricted tables directly.
      const { data, error } = await supabase.rpc("get_available_slots", {
        _date: date,
        _service_type_id: selectedService.id,
        _mechanic_id: null,
      });
      if (error) throw error;
      const allRows = (data ?? []) as Array<{
        start_time: string;
        end_time: string;
        mechanic_id: string;
        mechanic_name: string | null;
      }>;
      // Never offer slots already in the past (or too close) for the rider's
      // own local clock — minimum 30 min of notice.
      const rows = allRows.filter((r) =>
        isSlotSelectable(date, String(r.start_time).slice(0, 5)),
      );
      const mechMap = new Map<string, string>();
      rows.forEach((r) => {
        if (!mechMap.has(r.mechanic_id))
          mechMap.set(r.mechanic_id, r.mechanic_name ?? "Mecânico");
      });
      setMechanicsList(
        Array.from(mechMap.entries()).map(([id, name]) => ({ id, name })),
      );
      setSlots(
        rows.map((r) => ({
          start: r.start_time,
          end: r.end_time,
          mechanicId: r.mechanic_id,
          mechanicName: r.mechanic_name ?? "Mecânico",
        })),
      );
    } catch (e: any) {
      console.error("[book] slots error", e);
      toast.error("Falha ao calcular disponibilidade");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedService, date]);

  useEffect(() => {
    if (open && step === 3 && selectedService) computeSlots();
  }, [open, step, computeSlots, selectedService, version]);

  /* ---------- is the logged-in mechanic available on the chosen date? ---------- */
  useEffect(() => {
    if (!open || step !== 3 || !isWorkshopUser || !user?.id) {
      setMyDayOff(false);
      return;
    }
    let cancelled = false;
    getAvailability(user.id, date)
      .then((a) => !cancelled && setMyDayOff(!a.isWorking))
      .catch(() => !cancelled && setMyDayOff(false));
    return () => {
      cancelled = true;
    };
  }, [open, step, date, user?.id, isWorkshopUser, getAvailability, version]);

  const offerOwnAvailability = async () => {
    if (!user?.id) return;
    setOpeningDay(true);
    try {
      const opened = await ensureAvailability(user.id, date);
      if (opened) {
        setMyDayOff(false);
        await computeSlots();
      }
    } finally {
      setOpeningDay(false);
    }
  };

  /* ---------- preload calendar availability (closed days/exceptions) ---------- */
  useEffect(() => {
    if (!open || step !== 3) return;
    let cancelled = false;
    (async () => {
      const today = todayISO();
      const [bhRes, exRes] = await Promise.all([
        supabase.from("business_hours").select("day_of_week, is_open, valid_from, valid_until"),
        supabase
          .from("business_hour_exceptions")
          .select("exception_date, is_open")
          .gte("exception_date", today),
      ]);
      if (cancelled) return;
      // Pick latest valid per day_of_week
      const map = new Map<number, any>();
      for (const r of (bhRes.data ?? []) as any[]) {
        if (r.valid_from > today) continue;
        if (r.valid_until && r.valid_until < today) continue;
        const prev = map.get(r.day_of_week);
        if (!prev || prev.valid_from < r.valid_from) map.set(r.day_of_week, r);
      }
      const closed = new Set<number>();
      for (const [dow, r] of map) if (!r.is_open) closed.add(dow);
      setClosedDows(closed);
      const fClosed = new Set<string>();
      const fOpen = new Set<string>();
      for (const e of (exRes.data ?? []) as any[]) {
        if (e.is_open) fOpen.add(e.exception_date);
        else fClosed.add(e.exception_date);
      }
      setForcedClosedDates(fClosed);
      setForcedOpenDates(fOpen);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step]);

  /* ---------- submit ---------- */
  const submit = async () => {
    if (!customer || !selectedService || !slot) return;
    setSubmitting(true);
    try {
      const bikeLine =
        bikeModel || bikeSerial
          ? `Bicicleta: ${bikeModel || "—"}${bikeSerial ? ` · Nº série/matrícula: ${bikeSerial}` : ""}`
          : "";
      const combinedNotes = [bikeLine, notes].filter(Boolean).join("\n");

      const { error } = await supabase.from("appointments").insert({
        user_id: customer.user_id,
        service_type_id: selectedService.id,
        assigned_mechanic_id: slot.mechanicId,
        scheduled_date: date,
        scheduled_start_time: `${slot.start}:00`,
        scheduled_end_time: `${slot.end}:00`,
        duration_minutes: selectedService.duration_minutes,
        status: "confirmed",
        priority: "normal",
        booked_via: "admin",
        notes: combinedNotes || null,
      });
      if (error) throw error;

      toast.success("Agendamento registado");
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(describeSchedulingError(e));
      // The DB guard rejected it — availability changed meanwhile, refresh.
      computeSlots();
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- gating ---------- */
  const canNext1 = !!customer;
  const canNext2 = !!serviceId;
  const canSubmit = !!slot && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="text-lg font-light flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-wj-green" />
            Novo Agendamento
          </DialogTitle>
          <DialogDescription className="text-xs">
            {hasPreset
              ? `Passo ${step - 1} de 2 — ${step === 2 ? "Serviço" : "Data & horário"}`
              : `Passo ${step} de 3 — ${step === 1 ? "Cliente & bicicleta" : step === 2 ? "Serviço" : "Data & horário"}`}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1">
          {(hasPreset ? [2, 3] : [1, 2, 3]).map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                step >= s ? "bg-wj-green" : "bg-muted",
              )}
            />
          ))}
        </div>

        {/* STEP 1: Customer + bike */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Procurar cliente</Label>
              {!customer ? (
                <div className="mt-1">
                  <Combobox<Customer>
                    items={customers}
                    itemToValue={(c) => c.user_id}
                    itemToLabel={(c) => c.full_name ?? c.email ?? ""}
                    autoHighlight
                    placeholder="Nome ou email…"
                    searchValue={search}
                    onSearchChange={setSearch}
                    onSelect={(c) => {
                      setCustomer(c);
                      setSearch("");
                    }}
                  >
                    <ComboboxInput
                      placeholder="Nome ou email…"
                      className="text-sm"
                    />
                    <ComboboxContent hideInnerSearch className="p-0">
                      <ComboboxList<Customer>
                        className="max-h-56"
                        loading={searching}
                        loadingNode={
                          <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> A procurar…
                          </div>
                        }
                      >
                        {(c) => (
                          <ComboboxItem
                            key={c.user_id}
                            value={c.user_id}
                            showCheck={false}
                            className="flex-col items-start gap-0 py-2"
                          >
                            <span className="text-xs font-medium">{c.full_name ?? "—"}</span>
                            <span className="text-[10px] text-muted-foreground">{c.email}</span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                      {!searching && customers.length === 0 && (
                        <ComboboxEmpty>Nenhum cliente com bicicleta registada.</ComboboxEmpty>
                      )}
                    </ComboboxContent>
                  </Combobox>
                </div>
              ) : (
                <div className="mt-2 p-3 border border-wj-green/30 bg-wj-green/5 rounded-lg flex items-center justify-between">
                  <div className="text-xs">
                    <div className="font-medium">{customer.full_name ?? "—"}</div>
                    <div className="text-muted-foreground">{customer.email}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px]"
                    onClick={() => setCustomer(null)}
                  >
                    Trocar
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex flex-col">
                <Label className="text-xs flex items-center gap-1 h-4 leading-4">
                  <Bike className="h-3 w-3" /> Modelo da bicicleta
                </Label>
                <div className="mt-1">
                  {(() => {
                    const uniqueModels = Array.from(
                      new Map(
                        customerBikes
                          .filter((b) => !!b.model)
                          .map((b) => [b.model, b]),
                      ).values(),
                    );
                    return (
                      <Combobox<CustomerBike>
                        items={uniqueModels}
                        itemToValue={(b) => b.model}
                        itemToLabel={(b) => b.model}
                        value={bikeModel || null}
                        autoHighlight
                        disabled={!customer}
                        placeholder={
                          !customer
                            ? "Selecione um cliente…"
                            : uniqueModels.length === 0
                              ? "Sem modelos registados"
                              : "Selecionar modelo…"
                        }
                        onSelect={(b) => {
                          setBikeModel(b.model);
                          // reset serial if it doesn't belong to this model
                          const stillValid = customerBikes.some(
                            (cb) => cb.model === b.model && (cb.serial ?? "") === bikeSerial,
                          );
                          if (!stillValid) setBikeSerial("");
                        }}
                      >
                        <ComboboxTrigger className="text-sm h-9" />
                        <ComboboxContent innerSearchPlaceholder="Procurar modelo…">
                          <ComboboxList<CustomerBike>
                            className="max-h-56"
                            loading={customerBikesLoading}
                            loadingNode={
                              <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> A carregar…
                              </div>
                            }
                          >
                            {(b) => (
                              <ComboboxItem
                                key={b.id}
                                value={b.model}
                                className="flex-col items-start gap-0 py-2"
                                showCheck={false}
                              >
                                <span className="text-xs font-medium flex items-center gap-2">
                                  {b.color && (
                                    <span
                                      className="inline-block w-2 h-2 rounded-full"
                                      style={{ backgroundColor: b.color }}
                                    />
                                  )}
                                  {b.model}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {customerBikes.filter((cb) => cb.model === b.model).length}{" "}
                                  unidade(s) registada(s)
                                </span>
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                          <ComboboxEmpty>Sem modelos registados para este cliente.</ComboboxEmpty>
                        </ComboboxContent>
                      </Combobox>
                    );
                  })()}
                </div>
              </div>
              <div className="flex flex-col">
                <Label className="text-xs h-4 leading-4">Nº série / matrícula</Label>
                <div className="mt-1">
                  <Combobox<CustomerBike>
                    items={
                      bikeModel
                        ? customerBikes.filter((b) => b.model === bikeModel)
                        : customerBikes
                    }
                    itemToValue={(b) => b.id}
                    itemToLabel={(b) => b.serial ?? b.model}
                    value={
                      customerBikes.find((b) => (b.serial ?? "") === bikeSerial)?.id ?? null
                    }
                    autoHighlight
                    disabled={!customer || !bikeModel}
                    placeholder={
                      !customer
                        ? "Selecione um cliente…"
                        : !bikeModel
                          ? "Selecione o modelo…"
                          : customerBikes.filter((b) => b.model === bikeModel).length === 0
                            ? "Sem nº de série"
                            : "Selecionar nº de série…"
                    }
                    onSelect={(b) => {
                      setBikeSerial(b.serial ?? "");
                      if (b.model) setBikeModel(b.model);
                    }}
                  >
                    <ComboboxTrigger className="text-sm h-9" />
                    <ComboboxContent innerSearchPlaceholder="Procurar série…">
                      <ComboboxList<CustomerBike>
                        className="max-h-56"
                        loading={customerBikesLoading}
                        loadingNode={
                          <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> A carregar…
                          </div>
                        }
                      >
                        {(b) => (
                          <ComboboxItem
                            key={b.id}
                            value={b.id}
                            className="flex-col items-start gap-0 py-2"
                            showCheck={false}
                          >
                            <span className="text-xs font-medium flex items-center gap-2">
                              {b.color && (
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: b.color }}
                                />
                              )}
                              {b.serial ?? "Sem nº série"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {b.model}
                              {b.color ? ` · ${b.color}` : ""}
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                      <ComboboxEmpty>Sem nº de série para este modelo.</ComboboxEmpty>
                    </ComboboxContent>
                  </Combobox>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descrição do problema ou pedido…"
                className="mt-1 text-sm min-h-16"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Service */}
        {step === 2 && (
          <div className="space-y-3">
            <Label className="text-xs">Tipo de serviço</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {serviceTypes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServiceId(s.id)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors",
                    serviceId === s.id
                      ? "border-wj-green/60 bg-wj-green/5"
                      : "border-border/30 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: s.color ?? "#9ca3af" }}
                      />
                      {s.name}
                    </span>
                    {s.is_emergency && (
                      <Badge className="text-[9px] bg-red-500/20 text-red-400 border-red-500/30">
                        Urgência
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {s.duration_minutes}m
                    </span>
                    {s.base_price != null && <span>€ {Number(s.base_price).toFixed(2)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Date + slots */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> Selecione data e horário
              </Label>
              <Badge
                variant="outline"
                className="h-7 px-2.5 rounded-md border-border/40 bg-muted/30 text-[11px] font-normal text-muted-foreground gap-1.5"
              >
                <Clock className="h-3 w-3" />
                {selectedService?.name} · {selectedService?.duration_minutes}m
              </Badge>
            </div>

            <div className="flex flex-col md:flex-row gap-4 rounded-xl border border-border/30 bg-muted/10 p-3">
              {/* Calendar */}
              <div className="flex justify-center md:justify-start md:shrink-0">
                <Calendar
                  mode="single"
                  selected={date ? new Date(date + "T00:00:00") : undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    setDate(iso);
                  }}
                  disabled={(d) => {
                    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (d < today) return true;
                    if (forcedClosedDates.has(iso)) return true;
                    if (forcedOpenDates.has(iso)) return false;
                    return closedDows.has(d.getDay());
                  }}
                  className="rounded-lg p-2 pointer-events-auto"
                />
              </div>

              <Separator orientation="vertical" className="hidden md:block h-auto" />
              <Separator orientation="horizontal" className="md:hidden" />

              {/* Time slots */}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-2 px-1">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 truncate min-w-0">
                    <Clock className="h-3 w-3" />
                    <span className="truncate">{new Date(date + "T00:00:00").toLocaleDateString("pt-PT", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}</span>
                  </Label>
                  <Select value={mechanicFilter} onValueChange={(v) => { setMechanicFilter(v); setSlot(null); }}>
                    <SelectTrigger className="h-7 w-[140px] sm:w-[180px] text-[11px] shrink-0">
                      <SelectValue placeholder="Qualquer mecânico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer mecânico</SelectItem>
                      {mechanicsList.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ScrollArea className="h-[260px] pr-2">
                  {loadingSlots ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-11 rounded-lg border border-border/20 bg-muted/30 animate-pulse"
                          style={{ animationDelay: `${i * 50}ms` }}
                        />
                      ))}
                    </div>
                  ) : (() => {
                    const filtered = mechanicFilter === "any"
                      ? Array.from(new Map(slots.map((s) => [s.start, s])).values())
                      : slots.filter((s) => s.mechanicId === mechanicFilter);
                    if (filtered.length === 0) return (
                    <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center gap-1 border border-dashed border-border/40 rounded-lg">
                      <CalendarDays className="h-5 w-5 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground">
                        Sem horários disponíveis nesta data.
                      </p>
                      {isWorkshopUser && myDayOff ? (
                        <>
                          <p className="text-[10px] text-muted-foreground/70 max-w-[240px]">
                            Não tens disponibilidade marcada neste dia. Queres abrir a tua
                            disponibilidade para libertar o workload?
                          </p>
                          <Button
                            size="sm"
                            className="mt-2 h-7 rounded-full bg-wj-green hover:bg-wj-green/90 text-white text-[11px]"
                            onClick={offerOwnAvailability}
                            disabled={openingDay}
                          >
                            {openingDay ? "A abrir…" : "Abrir a minha disponibilidade"}
                          </Button>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/70">
                          Tente outra data no calendário.
                        </p>
                      )}
                    </div>);
                    return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-in fade-in-0 duration-200">
                      {filtered.map((s) => {
                        const active =
                          slot?.start === s.start && slot?.mechanicId === s.mechanicId;
                        return (
                          <button
                            key={`${s.start}-${s.mechanicId}`}
                            onClick={() => setSlot(s)}
                            className={cn(
                              "group flex flex-col items-start p-2 rounded-lg border text-left transition-all",
                              active
                                ? "border-wj-green/60 bg-wj-green/10 ring-1 ring-wj-green/40"
                                : "border-border/30 hover:bg-muted/40 hover:border-border/60",
                            )}
                          >
                            <span className="text-sm font-medium">{s.start}</span>
                            <span className="text-[9px] text-muted-foreground truncate w-full flex items-center gap-1">
                              <UserCheck className="h-2.5 w-2.5" />
                              {s.mechanicName}
                            </span>
                          </button>
                        );
                      })}
                    </div>);
                  })()}
                </ScrollArea>
              </div>
            </div>

            {slot && (
              <div className="p-3 rounded-lg border border-wj-green/30 bg-wj-green/5 text-xs space-y-1 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-wj-green" /> Pronto a confirmar
                </div>
                <div className="text-muted-foreground">
                  {customer?.full_name} · {selectedService?.name} · {date} {slot.start}–{slot.end} · {slot.mechanicName}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && !(hasPreset && step === 2) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              disabled={submitting}
            >
              Voltar
            </Button>
          )}
          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
              className="bg-wj-green hover:bg-wj-green/90 text-black"
            >
              Continuar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={submit}
              disabled={!canSubmit}
              className="bg-wj-green hover:bg-wj-green/90 text-black"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" /> A registar…
                </>
              ) : (
                "Confirmar agendamento"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}