import { useMemo, useState } from "react";
import { format } from "date-fns";
import { pt, enGB } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  MoreHorizontal,
  PlayCircle,
  CheckCircle,
  CalendarClock,
  UserCog,
  Wrench,
  Ban,
  Trash2,
  Calendar as CalIcon,
  History,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import QuickSlotPicker from "@/components/dashboard/scheduling/QuickSlotPicker";
import { isTaskOverdue } from "@/lib/scheduling/taskPriority";
import type {
  AppointmentRow,
  Mechanic,
  ServiceType,
} from "@/hooks/scheduling/useSchedulingData";

interface Props {
  appointment: AppointmentRow;
  mechanics: Mechanic[];
  serviceTypes: ServiceType[];
  onStart: () => void;
  onComplete: () => void;
  onReviewHistory: () => void;
  onExtendTime: (extraMinutes: number) => void;
  onUpdateFields: (
    id: string,
    patch: Partial<{
      assigned_mechanic_id: string | null;
      service_type_id: string | null;
    }>,
  ) => Promise<boolean>;
  onReschedule: (
    id: string,
    date: string,
    startTime: string,
    durationMinutes?: number | null,
  ) => Promise<boolean>;
  onCancel: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

function timeSlots(): string[] {
  const out: string[] = [];
  for (let h = 8; h <= 19; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

export default function AppointmentActionsMenu({
  appointment,
  mechanics,
  serviceTypes,
  onStart,
  onComplete,
  onReviewHistory,
  onExtendTime,
  onUpdateFields,
  onReschedule,
  onCancel,
  onDelete,
}: Props) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "pt" ? pt : enGB;
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [mechanicOpen, setMechanicOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraMin, setExtraMin] = useState<string>("15");

  const canStart =
    appointment.status === "confirmed" || appointment.status === "pending";
  const canComplete = appointment.status === "in_progress";
  const isTerminal =
    appointment.status === "completed" ||
    appointment.status === "canceled" ||
    appointment.status === "no_show";

  /* reschedule local state */
  const [date, setDate] = useState<Date>(new Date(appointment.scheduled_date));
  const [time, setTime] = useState<string>(
    appointment.scheduled_start_time.slice(0, 5),
  );

  /* change mechanic state */
  const [mechanicId, setMechanicId] = useState<string>(
    appointment.assigned_mechanic_id ?? "unassigned",
  );

  /* change service state */
  const [serviceId, setServiceId] = useState<string>(
    appointment.service_type_id ?? "",
  );

  const slots = useMemo(() => timeSlots(), []);
  const overdue = isTaskOverdue(appointment as any);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-muted/60"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            <span className="sr-only">{t("workshop.actions.menu_aria")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 bg-background/95 backdrop-blur-xl border-border/40"
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("workshop.actions.status_label")}
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!canStart}
            onClick={onStart}
            className="text-xs"
          >
            <PlayCircle className="h-3.5 w-3.5 mr-2 text-blue-400" /> {t("workshop.actions.start")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canComplete}
            onClick={onComplete}
            className="text-xs"
          >
            <CheckCircle className="h-3.5 w-3.5 mr-2 text-wj-green" /> {t("workshop.actions.complete")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onReviewHistory}
            className="text-xs"
          >
            <History className="h-3.5 w-3.5 mr-2 text-wj-green" /> {t("workshop.actions.history")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canComplete}
            onClick={() => setExtraOpen(true)}
            className="text-xs"
          >
            <TimerReset className="h-3.5 w-3.5 mr-2 text-amber-400" /> {t("workshop.actions.more_time")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("workshop.actions.modify_label")}
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={isTerminal}
            onClick={() => setRescheduleOpen(true)}
            className="text-xs"
          >
            <CalendarClock className="h-3.5 w-3.5 mr-2" /> {t("workshop.actions.reschedule")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isTerminal}
            onClick={() => setMechanicOpen(true)}
            className="text-xs"
          >
            <UserCog className="h-3.5 w-3.5 mr-2" /> {t("workshop.actions.change_mechanic")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isTerminal}
            onClick={() => setServiceOpen(true)}
            className="text-xs"
          >
            <Wrench className="h-3.5 w-3.5 mr-2" /> {t("workshop.actions.change_service")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isTerminal}
            onClick={() => setCancelOpen(true)}
            className="text-xs text-amber-400 focus:text-amber-300"
          >
            <Ban className="h-3.5 w-3.5 mr-2" /> {t("workshop.actions.cancel")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-xs text-red-400 focus:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> {t("workshop.actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reschedule */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-border/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-light flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-wj-green" /> {t("workshop.actions.reschedule_title")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("workshop.actions.reschedule_desc", {
                name: appointment.customer_name ?? t("workshop.actions.reschedule_customer_fallback"),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <QuickSlotPicker
              serviceTypeId={appointment.service_type_id}
              enabled={rescheduleOpen}
              urgent={overdue}
              selected={{ date: format(date, "yyyy-MM-dd"), start: time }}
              onSelect={(s) => {
                setDate(new Date(`${s.date}T00:00:00`));
                setTime(s.start.slice(0, 5));
              }}
            />
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("workshop.actions.date")}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-xs border-border/40",
                    )}
                  >
                    <CalIcon className="mr-2 h-3.5 w-3.5" />
                    {format(date, "EEEE, d 'de' LLLL yyyy", { locale: dateLocale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto p-0 bg-background/95 backdrop-blur-xl border-border/40"
                >
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("workshop.actions.time")}
              </Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="h-9 text-xs border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {slots.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRescheduleOpen(false)}
            >
              {t("workshop.actions.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-wj-green hover:bg-wj-green/90 text-black"
              onClick={async () => {
                const ok = await onReschedule(
                  appointment.id,
                  format(date, "yyyy-MM-dd"),
                  `${time}:00`,
                  appointment.duration_minutes ?? null,
                );
                if (ok) setRescheduleOpen(false);
              }}
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1" /> {t("workshop.actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change mechanic */}
      <Dialog open={mechanicOpen} onOpenChange={setMechanicOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-border/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-light flex items-center gap-2">
              <UserCog className="h-4 w-4 text-wj-green" /> {t("workshop.actions.mechanic_title")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("workshop.actions.mechanic_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("workshop.actions.mechanic_label")}
            </Label>
            <Select value={mechanicId} onValueChange={setMechanicId}>
              <SelectTrigger className="h-9 text-xs border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned" className="text-xs">
                  {t("workshop.actions.mechanic_unassigned")}
                </SelectItem>
                {mechanics.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                    {m.full_name ?? m.email ?? m.user_id.slice(0, 8)}
                    <span className="text-muted-foreground/60 ml-2">
                      · {m.weekly_appointments}/{m.weekly_capacity}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMechanicOpen(false)}
            >
              {t("workshop.actions.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-wj-green hover:bg-wj-green/90 text-black"
              onClick={async () => {
                const ok = await onUpdateFields(appointment.id, {
                  assigned_mechanic_id:
                    mechanicId === "unassigned" ? null : mechanicId,
                });
                if (ok) setMechanicOpen(false);
              }}
            >
              {t("workshop.actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change service */}
      <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-border/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-light flex items-center gap-2">
              <Wrench className="h-4 w-4 text-wj-green" /> {t("workshop.actions.service_title")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("workshop.actions.service_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("workshop.actions.service_label")}
            </Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="h-9 text-xs border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: s.color ?? "#9ca3af" }}
                    />
                    {s.name}
                    <span className="text-muted-foreground/60 ml-2">
                      · {s.duration_minutes}m
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setServiceOpen(false)}
            >
              {t("workshop.actions.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!serviceId}
              className="bg-wj-green hover:bg-wj-green/90 text-black"
              onClick={async () => {
                const ok = await onUpdateFields(appointment.id, {
                  service_type_id: serviceId,
                });
                if (ok) setServiceOpen(false);
              }}
            >
              {t("workshop.actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="bg-background/95 backdrop-blur-xl border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-light">
              {t("workshop.actions.cancel_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t("workshop.actions.cancel_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">{t("workshop.actions.back")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-500/90 text-black text-xs"
              onClick={async () => {
                await onCancel(appointment.id);
              }}
            >
              {t("workshop.actions.cancel_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-background/95 backdrop-blur-xl border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-light">
              {t("workshop.actions.delete_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t("workshop.actions.delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">{t("workshop.actions.back")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-500/90 text-white text-xs"
              onClick={async () => {
                await onDelete(appointment.id);
              }}
            >
              {t("workshop.actions.delete_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Need extra time */}
      <Dialog open={extraOpen} onOpenChange={setExtraOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-border/40 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-light flex items-center gap-2">
              <TimerReset className="h-4 w-4 text-amber-400" /> {t("workshop.actions.extra_title")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("workshop.actions.extra_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("workshop.actions.extra_label")}
            </Label>
            <Select value={extraMin} onValueChange={setExtraMin}>
              <SelectTrigger className="h-9 text-xs border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["10", "15", "30", "45", "60"].map((v) => (
                  <SelectItem key={v} value={v} className="text-xs">
                    +{v} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setExtraOpen(false)}>
              {t("workshop.actions.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-500/90 text-black"
              onClick={() => {
                onExtendTime(parseInt(extraMin, 10) || 15);
                setExtraOpen(false);
              }}
            >
              {t("workshop.actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}