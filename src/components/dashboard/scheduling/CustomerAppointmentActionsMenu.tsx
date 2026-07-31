import { useMemo, useState } from "react";
import { format } from "date-fns";
import { pt, enGB } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  MoreHorizontal,
  CalendarClock,
  Ban,
  Calendar as CalIcon,
  Info,
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
import type { AppointmentRow } from "@/hooks/scheduling/useSchedulingData";
import QuickSlotPicker from "@/components/dashboard/scheduling/QuickSlotPicker";
import { isTaskOverdue } from "@/lib/scheduling/taskPriority";

interface Props {
  appointment: AppointmentRow;
  onViewDetails: () => void;
  onReschedule: (
    id: string,
    date: string,
    startTime: string,
    durationMinutes?: number | null,
  ) => Promise<boolean>;
  onCancel: (id: string) => Promise<boolean>;
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

/**
 * Customer-scoped actions for their own appointments: view details, reschedule,
 * or cancel. No admin-only capabilities (start/complete/change mechanic/delete).
 */
export default function CustomerAppointmentActionsMenu({
  appointment,
  onViewDetails,
  onReschedule,
  onCancel,
}: Props) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "pt" ? pt : enGB;

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date(appointment.scheduled_date));
  const [time, setTime] = useState<string>(appointment.scheduled_start_time.slice(0, 5));

  const isTerminal =
    appointment.status === "completed" ||
    appointment.status === "canceled" ||
    appointment.status === "no_show";

  const slots = useMemo(() => timeSlots(), []);
  const overdue = isTaskOverdue(appointment as any);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-muted/60">
            <MoreHorizontal className="h-3.5 w-3.5" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 bg-background/95 backdrop-blur-xl border-border/40"
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("workshop.actions.menu_aria", "Actions")}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onViewDetails} className="text-xs">
            <Info className="h-3.5 w-3.5 mr-2 text-wj-green" /> {t("workshop.actions.history", "Details")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isTerminal}
            onClick={() => setRescheduleOpen(true)}
            className="text-xs"
          >
            <CalendarClock className="h-3.5 w-3.5 mr-2" /> {t("workshop.actions.reschedule", "Reschedule")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isTerminal}
            onClick={() => setCancelOpen(true)}
            className="text-xs text-amber-400 focus:text-amber-300"
          >
            <Ban className="h-3.5 w-3.5 mr-2" /> {t("workshop.actions.cancel", "Cancel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reschedule */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-border/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-light flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-wj-green" />{" "}
              {t("workshop.actions.reschedule_title", "Reschedule appointment")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "workshop.actions.reschedule_desc",
                "Pick a new date and time for your appointment.",
              )}
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
                {t("workshop.actions.date", "Date")}
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
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("workshop.actions.time", "Time")}
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
            <Button variant="ghost" size="sm" onClick={() => setRescheduleOpen(false)}>
              {t("workshop.actions.cancel", "Cancel")}
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
              <CalendarClock className="h-3.5 w-3.5 mr-1" />{" "}
              {t("workshop.actions.confirm", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="bg-background/95 backdrop-blur-xl border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-light">
              {t("workshop.actions.cancel_title", "Cancel this appointment?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t(
                "workshop.actions.cancel_desc",
                "This will notify the team. You can always book a new appointment later.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">
              {t("workshop.actions.back", "Back")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-500/90 text-black text-xs"
              onClick={async () => {
                await onCancel(appointment.id);
              }}
            >
              {t("workshop.actions.cancel_btn", "Cancel appointment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}