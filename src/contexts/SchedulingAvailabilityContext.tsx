import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CalendarClock } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  fetchStaffDayAvailability,
  isWorkshopOpen,
  setStaffDayAvailability,
  type StaffDayAvailability,
} from "@/lib/scheduling/availabilityGuard";

interface PendingAsk {
  staffId: string;
  date: string;
  resolve: (opened: boolean) => void;
}

interface SchedulingAvailabilityValue {
  /** Bumped whenever availability changes — consumers can use it to refetch slots. */
  version: number;
  /** Cached (and deduped) availability lookup for a staff member on a date. */
  getAvailability: (staffId: string, date: string, force?: boolean) => Promise<StaffDayAvailability>;
  /** Is the workshop open on that date (weekly hours + holiday exceptions). */
  workshopOpen: (date: string) => Promise<boolean>;
  /**
   * Guarantees availability for a date: if the staff member is off duty, asks
   * "would you like to open your availability?" and, on confirmation, creates
   * the working exception. Resolves to true when the day is bookable.
   */
  ensureAvailability: (staffId: string, date: string) => Promise<boolean>;
  /** Opens a day directly, without asking. */
  openDay: (staffId: string, date: string, start?: string, end?: string) => Promise<void>;
  invalidate: () => void;
}

const Ctx = createContext<SchedulingAvailabilityValue | undefined>(undefined);

export function SchedulingAvailabilityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const cache = useRef(new Map<string, Promise<StaffDayAvailability>>());
  const openCache = useRef(new Map<string, Promise<boolean>>());
  const [pending, setPending] = useState<PendingAsk | null>(null);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [saving, setSaving] = useState(false);

  const invalidate = useCallback(() => {
    cache.current.clear();
    openCache.current.clear();
    setVersion((v) => v + 1);
  }, []);

  const getAvailability = useCallback(
    (staffId: string, date: string, force = false) => {
      const key = `${staffId}|${date}`;
      if (force) cache.current.delete(key);
      let p = cache.current.get(key);
      if (!p) {
        p = fetchStaffDayAvailability(staffId, date);
        cache.current.set(key, p);
      }
      return p;
    },
    [],
  );

  const workshopOpen = useCallback((date: string) => {
    let p = openCache.current.get(date);
    if (!p) {
      p = isWorkshopOpen(date);
      openCache.current.set(date, p);
    }
    return p;
  }, []);

  const openDay = useCallback(
    async (staffId: string, date: string, s = "09:00", e = "18:00") => {
      await setStaffDayAvailability({ staffId, date, isWorking: true, start: s, end: e });
      invalidate();
    },
    [invalidate],
  );

  const ensureAvailability = useCallback(
    async (staffId: string, date: string) => {
      if (!(await workshopOpen(date))) {
        toast.error("The workshop is closed on that date.");
        return false;
      }
      const availability = await getAvailability(staffId, date, true);
      if (availability.isWorking) return true;

      // Only the staff member themself (or an admin) can open the day.
      const canOpen = user?.id === staffId || user?.role === "admin";
      if (!canOpen) return false;

      return new Promise<boolean>((resolve) => {
        setStart("09:00");
        setEnd("18:00");
        setPending({ staffId, date, resolve });
      });
    },
    [getAvailability, workshopOpen, user],
  );

  const confirmOpen = async () => {
    if (!pending) return;
    if (end <= start) {
      toast.error("End time must be after the start time.");
      return;
    }
    setSaving(true);
    try {
      await openDay(pending.staffId, pending.date, start, end);
      toast.success("Availability opened for that day.");
      pending.resolve(true);
      setPending(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open the availability.");
    } finally {
      setSaving(false);
    }
  };

  const dismiss = () => {
    pending?.resolve(false);
    setPending(null);
  };

  const value = useMemo(
    () => ({ version, getAvailability, workshopOpen, ensureAvailability, openDay, invalidate }),
    [version, getAvailability, workshopOpen, ensureAvailability, openDay, invalidate],
  );

  const prettyDate = pending
    ? new Date(`${pending.date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={!!pending} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-light">
              <CalendarClock className="h-4 w-4 text-wj-green" />
              No availability on {prettyDate}
            </DialogTitle>
            <DialogDescription className="text-xs">
              You are not scheduled to work on this day. Would you like to open your availability so
              this day becomes bookable for the workshop?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="avail-start" className="text-[11px] text-muted-foreground">
                Start
              </Label>
              <Input
                id="avail-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avail-end" className="text-[11px] text-muted-foreground">
                End
              </Label>
              <Input
                id="avail-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" className="rounded-full" onClick={dismiss} disabled={saving}>
              Keep me off duty
            </Button>
            <Button
              className="rounded-full bg-wj-green hover:bg-wj-green/90 text-white"
              onClick={confirmOpen}
              disabled={saving}
            >
              {saving ? "Opening…" : "Open availability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useSchedulingAvailability() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useSchedulingAvailability must be used within SchedulingAvailabilityProvider");
  }
  return ctx;
}
