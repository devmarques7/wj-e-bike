import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CalendarDays, Bike as BikeIcon, AlertTriangle, Plus, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CrmBike } from "@/hooks/crm/useCrmData";
import type { ServiceType } from "@/hooks/scheduling/useSchedulingData";

type Slot = {
  start: string;
  end: string;
  mechanicId: string;
  mechanicName: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  customerUserId: string;
  customerId: string;
  customerName?: string | null;
  bikes: CrmBike[];
  onCreated?: () => void;
}

import { localYmd } from "@/lib/scheduling/localDate";
const todayISO = () => localYmd(new Date());
const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export default function ScheduleAppointmentDialog({
  open,
  onClose,
  customerUserId,
  customerId,
  customerName,
  bikes,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const [localBikes, setLocalBikes] = useState<CrmBike[]>([]);
  const activeBikes = useMemo(
    () => [...bikes.filter((b) => b.is_active), ...localBikes],
    [bikes, localBikes],
  );
  const hasBikes = activeBikes.length > 0;

  // Register-bike sub-state
  const [registerMode, setRegisterMode] = useState<null | "manual" | "stock">(null);
  const [stockProducts, setStockProducts] = useState<
    Array<{ id: string; name: string; color_hex: string | null; sku_prefix: string | null }>
  >([]);
  const [stockProductId, setStockProductId] = useState("");
  const [bikeForm, setBikeForm] = useState({
    model: "",
    serial: "",
    color: "",
    km: "",
    purchased_at: "",
  });
  const [registering, setRegistering] = useState(false);

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [bikeId, setBikeId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () => serviceTypes.find((s) => s.id === serviceId) ?? null,
    [serviceTypes, serviceId],
  );

  /* reset on close */
  useEffect(() => {
    if (!open) {
      setBikeId("");
      setServiceId("");
      setDate(todayISO());
      setNotes("");
      setSlot(null);
      setSlots([]);
      setRegisterMode(null);
      setLocalBikes([]);
      setStockProductId("");
      setBikeForm({ model: "", serial: "", color: "", km: "", purchased_at: "" });
    } else {
      if (activeBikes.length === 1) setBikeId(activeBikes[0].id);
    }
  }, [open, activeBikes]);

  /* load bike products from stock when needed */
  useEffect(() => {
    if (!open || registerMode !== "stock" || stockProducts.length > 0) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, color_hex, sku_prefix")
        .eq("product_type", "bike")
        .eq("is_active", true)
        .order("name", { ascending: true });
      setStockProducts((data ?? []) as any);
    })();
  }, [open, registerMode, stockProducts.length]);

  const registerBike = async () => {
    let payload: any = { customer_id: customerId, is_active: true, km: 0 };
    if (registerMode === "stock") {
      const p = stockProducts.find((x) => x.id === stockProductId);
      if (!p) {
        toast.error(t("crm.schedule_modal.register_bike.select_stock_required"));
        return;
      }
      payload = {
        ...payload,
        model: p.name,
        color: p.color_hex ?? null,
        serial: bikeForm.serial.trim() || null,
        km: Number(bikeForm.km) || 0,
        purchased_at: bikeForm.purchased_at || null,
      };
    } else {
      if (!bikeForm.model.trim()) {
        toast.error(t("crm.schedule_modal.register_bike.model_required"));
        return;
      }
      payload = {
        ...payload,
        model: bikeForm.model.trim(),
        serial: bikeForm.serial.trim() || null,
        color: bikeForm.color.trim() || null,
        km: Number(bikeForm.km) || 0,
        purchased_at: bikeForm.purchased_at || null,
      };
    }
    setRegistering(true);
    try {
      const { data, error } = await supabase
        .from("customer_bikes")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      toast.success(t("crm.schedule_modal.register_bike.created"));
      setLocalBikes((prev) => [...prev, data as CrmBike]);
      setBikeId((data as any).id);
      setRegisterMode(null);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message ?? t("crm.schedule_modal.register_bike.error"));
    } finally {
      setRegistering(false);
    }
  };

  /* load service types */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (!cancelled && !error) setServiceTypes((data ?? []) as ServiceType[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* compute availability */
  const computeSlots = useCallback(async () => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setSlot(null);
    try {
      const dow = new Date(date + "T00:00:00").getDay();

      const { data: bhData } = await supabase
        .from("business_hours")
        .select("*")
        .eq("day_of_week", dow)
        .lte("valid_from", date);
      const validBh = (bhData ?? [])
        .filter((r: any) => !r.valid_until || r.valid_until >= date)
        .sort((a: any, b: any) => (a.valid_from < b.valid_from ? 1 : -1))[0];

      const { data: bheData } = await supabase
        .from("business_hour_exceptions")
        .select("*")
        .eq("exception_date", date)
        .maybeSingle();

      let openTime: string | null = validBh?.open_time ?? null;
      let closeTime: string | null = validBh?.close_time ?? null;
      let workshopOpen = !!validBh?.is_open;
      const buffer = validBh?.buffer_minutes ?? 15;

      if (bheData) {
        workshopOpen = !!bheData.is_open;
        openTime = bheData.open_time ?? openTime;
        closeTime = bheData.close_time ?? closeTime;
      }

      if (!workshopOpen || !openTime || !closeTime) {
        setSlots([]);
        return;
      }

      const { data: ssData } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("day_of_week", dow)
        .eq("is_working", true)
        .lte("valid_from", date);
      const validSs = (ssData ?? []).filter(
        (r: any) => !r.valid_until || r.valid_until >= date,
      );
      const ssByStaff = new Map<string, any>();
      for (const r of validSs) {
        const prev = ssByStaff.get(r.staff_id);
        if (!prev || prev.valid_from < r.valid_from) ssByStaff.set(r.staff_id, r);
      }
      const staffIds = Array.from(ssByStaff.keys());
      if (staffIds.length === 0) {
        setSlots([]);
        return;
      }

      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds);
      const nameMap = new Map<string, string>(
        (profs ?? []).map((p: any) => [p.user_id, p.full_name ?? "—"]),
      );

      const { data: appts } = await supabase
        .from("appointments")
        .select("assigned_mechanic_id, scheduled_start_time, duration_minutes")
        .eq("scheduled_date", date)
        .in("status", ["pending", "confirmed", "in_progress"]);
      const busyByMech = new Map<string, Array<[number, number]>>();
      (appts ?? []).forEach((a: any) => {
        if (!a.assigned_mechanic_id) return;
        const s = toMinutes(a.scheduled_start_time);
        const e = s + (a.duration_minutes ?? selectedService.duration_minutes);
        const arr = busyByMech.get(a.assigned_mechanic_id) ?? [];
        arr.push([s, e]);
        busyByMech.set(a.assigned_mechanic_id, arr);
      });

      const dur = selectedService.duration_minutes;
      const stepMin = 30;
      const openM = toMinutes(openTime);
      const closeM = toMinutes(closeTime);
      const out: Slot[] = [];
      for (let tm = openM; tm + dur <= closeM; tm += stepMin) {
        for (const staffId of staffIds) {
          const sched = ssByStaff.get(staffId);
          const sStart = toMinutes(sched.start_time);
          const sEnd = toMinutes(sched.end_time);
          if (tm < sStart || tm + dur > sEnd) continue;
          const busy = busyByMech.get(staffId) ?? [];
          const overlaps = busy.some(
            ([bs, be]) => Math.max(bs, tm) < Math.min(be, tm + dur + buffer),
          );
          if (overlaps) continue;
          out.push({
            start: fromMinutes(tm),
            end: fromMinutes(tm + dur),
            mechanicId: staffId,
            mechanicName: nameMap.get(staffId) ?? "—",
          });
          break;
        }
      }
      setSlots(out);
      if (out.length > 0) setSlot(out[0]); // best/earliest slot pre-selected
    } catch (e: any) {
      console.error("[schedule] slots error", e);
      toast.error(t("crm.schedule_modal.error_slots"));
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedService, date, t]);

  useEffect(() => {
    if (open && selectedService) computeSlots();
  }, [open, selectedService, date, computeSlots]);

  const canSubmit =
    hasBikes && !!bikeId && !!serviceId && !!slot && !submitting;

  const submit = async () => {
    if (!canSubmit || !selectedService || !slot) return;
    const bike = activeBikes.find((b) => b.id === bikeId);
    setSubmitting(true);
    try {
      const bikeLine = bike
        ? `${t("crm.schedule_modal.bike")}: ${bike.model}${bike.serial ? ` · ${bike.serial}` : ""}`
        : "";
      const combinedNotes = [bikeLine, notes].filter(Boolean).join("\n");

      const { error } = await supabase.from("appointments").insert({
        user_id: customerUserId,
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

      toast.success(t("crm.schedule_modal.created"));
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? t("crm.schedule_modal.error_create"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl bg-background/95 backdrop-blur-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="text-lg font-light flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-wj-green" />
            {t("crm.schedule_modal.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {customerName
              ? t("crm.schedule_modal.subtitle_for", { name: customerName })
              : t("crm.schedule_modal.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {!hasBikes ? (
          <div className="space-y-4">
            {registerMode === null && (
              <div className="p-6 text-center space-y-4">
                <AlertTriangle className="h-8 w-8 text-orange-400 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm">{t("crm.schedule_modal.no_bikes_title")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("crm.schedule_modal.register_bike.choose_source")}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setRegisterMode("stock")}
                    className="h-auto py-3 flex-col gap-1"
                  >
                    <Package className="h-4 w-4" />
                    <span className="text-xs">{t("crm.schedule_modal.register_bike.from_stock")}</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRegisterMode("manual")}
                    className="h-auto py-3 flex-col gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-xs">{t("crm.schedule_modal.register_bike.manual")}</span>
                  </Button>
                </div>
              </div>
            )}

            {registerMode === "stock" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">{t("crm.schedule_modal.register_bike.stock_product")}</Label>
                  <Select value={stockProductId} onValueChange={setStockProductId}>
                    <SelectTrigger className="mt-1 text-sm h-9">
                      <SelectValue placeholder={t("crm.schedule_modal.register_bike.select_stock")} />
                    </SelectTrigger>
                    <SelectContent>
                      {stockProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="text-sm">
                            {p.name}
                            {p.sku_prefix ? ` · ${p.sku_prefix}` : ""}
                          </span>
                        </SelectItem>
                      ))}
                      {stockProducts.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          {t("crm.schedule_modal.register_bike.no_stock")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("crm.schedule_modal.register_bike.serial")}</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={bikeForm.serial}
                      onChange={(e) => setBikeForm({ ...bikeForm, serial: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t("crm.schedule_modal.register_bike.km")}</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      type="number"
                      min={0}
                      value={bikeForm.km}
                      onChange={(e) => setBikeForm({ ...bikeForm, km: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t("crm.schedule_modal.register_bike.purchased_at")}</Label>
                  <DatePicker
                    value={bikeForm.purchased_at}
                    onChange={(v) => setBikeForm({ ...bikeForm, purchased_at: v ?? "" })}
                    className="mt-1 w-full"
                  />
                </div>
              </div>
            )}

            {registerMode === "manual" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">{t("crm.schedule_modal.register_bike.model")}*</Label>
                  <Input
                    className="mt-1 h-9 text-sm"
                    value={bikeForm.model}
                    onChange={(e) => setBikeForm({ ...bikeForm, model: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("crm.schedule_modal.register_bike.serial")}</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={bikeForm.serial}
                      onChange={(e) => setBikeForm({ ...bikeForm, serial: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t("crm.schedule_modal.register_bike.color")}</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={bikeForm.color}
                      onChange={(e) => setBikeForm({ ...bikeForm, color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("crm.schedule_modal.register_bike.km")}</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      type="number"
                      min={0}
                      value={bikeForm.km}
                      onChange={(e) => setBikeForm({ ...bikeForm, km: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t("crm.schedule_modal.register_bike.purchased_at")}</Label>
                    <DatePicker
                      value={bikeForm.purchased_at}
                      onChange={(v) => setBikeForm({ ...bikeForm, purchased_at: v ?? "" })}
                      className="mt-1 w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {registerMode !== null && (
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setRegisterMode(null)} disabled={registering}>
                  {t("crm.actions.cancel")}
                </Button>
                <Button
                  size="sm"
                  className="bg-wj-green hover:bg-wj-green/90"
                  onClick={registerBike}
                  disabled={registering}
                >
                  {registering && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  {t("crm.schedule_modal.register_bike.save")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bike */}
            <div>
              <Label className="text-xs flex items-center gap-1">
                <BikeIcon className="h-3 w-3" /> {t("crm.schedule_modal.bike")}
              </Label>
              <Select value={bikeId} onValueChange={setBikeId}>
                <SelectTrigger className="mt-1 text-sm h-9">
                  <SelectValue placeholder={t("crm.schedule_modal.select_bike")} />
                </SelectTrigger>
                <SelectContent>
                  {activeBikes.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="text-sm">
                        {b.model}
                        {b.serial ? ` · ${b.serial}` : ""}
                        {b.color ? ` · ${b.color}` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service */}
            <div>
              <Label className="text-xs">{t("crm.schedule_modal.service")}</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="mt-1 text-sm h-9">
                  <SelectValue placeholder={t("crm.schedule_modal.select_service")} />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="text-sm">
                        {s.name} · {s.duration_minutes} min
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div>
              <Label className="text-xs">{t("crm.schedule_modal.date")}</Label>
              <DatePicker
                value={date}
                onChange={(v) => v && setDate(v)}
                min={todayISO()}
                className="mt-1 w-full"
              />
            </div>

            {/* Slot */}
            {serviceId && (
              <div>
                <Label className="text-xs flex items-center justify-between">
                  <span>{t("crm.schedule_modal.available_slot")}</span>
                  {loadingSlots && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t("crm.schedule_modal.loading_slots")}
                    </span>
                  )}
                </Label>
                {!loadingSlots && slots.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 p-3 border border-border/30 rounded-lg text-center">
                    {t("crm.schedule_modal.no_slots")}
                  </p>
                )}
                {slots.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto">
                    {slots.slice(0, 24).map((s) => {
                      const sel = slot && s.start === slot.start && s.mechanicId === slot.mechanicId;
                      return (
                        <button
                          key={`${s.start}-${s.mechanicId}`}
                          type="button"
                          onClick={() => setSlot(s)}
                          className={cn(
                            "text-left rounded-lg border p-2 transition-colors",
                            sel
                              ? "border-wj-green bg-wj-green/10"
                              : "border-border/40 hover:bg-muted/40",
                          )}
                        >
                          <div className="text-sm font-medium">{s.start}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {s.mechanicName}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {slot && (
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <Badge variant="outline" className="text-[10px]">
                      {slot.start} → {slot.end}
                    </Badge>
                    <span className="text-muted-foreground">
                      {t("crm.schedule_modal.with")} {slot.mechanicName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <Label className="text-xs">{t("crm.schedule_modal.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 text-sm"
                placeholder={t("crm.schedule_modal.notes_placeholder")}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("crm.actions.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-wj-green hover:bg-wj-green/90"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {t("crm.schedule_modal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}