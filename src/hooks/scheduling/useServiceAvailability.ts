/**
 * Reusable availability hook.
 *
 * Any component that needs to know which service slots are really free
 * (assistant, booking page, urgent service, CRM quick-book) can use this.
 * It never exposes mechanic names — only conflict-free time slots.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  bookSlot,
  createAppointmentRequest,
  fetchAvailability,
  fetchDaySlots,
  fetchServiceTypes,
  resolveServiceType,
  type AvailableSlot,
  type DayAvailability,
  type RequestPeriod,
  type ServiceTypeLite,
} from "@/lib/scheduling/availability";

export interface UseServiceAvailabilityOptions {
  /** Service slug/name hint (e.g. from a diagnosis briefing). */
  serviceHint?: string | null;
  /** Explicit service type id — wins over the hint. */
  serviceTypeId?: string | null;
  /** How many days ahead to scan. */
  days?: number;
  /** Load availability as soon as the service type resolves. */
  autoLoad?: boolean;
}

export function useServiceAvailability(options: UseServiceAvailabilityOptions = {}) {
  const { serviceHint = null, serviceTypeId = null, days = 7, autoLoad = true } = options;
  const { user } = useAuth();

  const [serviceTypes, setServiceTypes] = useState<ServiceTypeLite[]>([]);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchServiceTypes().then((types) => {
      if (!cancelled) setServiceTypes(types);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const serviceType = useMemo(() => {
    if (serviceTypeId) return serviceTypes.find((t) => t.id === serviceTypeId) ?? null;
    return resolveServiceType(serviceTypes, serviceHint);
  }, [serviceTypes, serviceTypeId, serviceHint]);

  const refresh = useCallback(async () => {
    if (!serviceType) return [] as DayAvailability[];
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAvailability(serviceType.id, days);
      setAvailability(result);
      setLoaded(true);
      return result;
    } catch (e: any) {
      setError(e?.message ?? "Could not load availability");
      return [] as DayAvailability[];
    } finally {
      setLoading(false);
    }
  }, [serviceType, days]);

  useEffect(() => {
    if (autoLoad && serviceType) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, serviceType?.id]);

  const slotsForDate = useCallback(
    async (date: string) => {
      if (!serviceType) return [] as AvailableSlot[];
      return fetchDaySlots(date, serviceType.id);
    },
    [serviceType],
  );

  const book = useCallback(
    async (args: { date: string; slot: AvailableSlot; urgent?: boolean; notes?: string }) => {
      if (!user?.id || !serviceType) throw new Error("Not ready to book");
      setSubmitting(true);
      try {
        return await bookSlot({
          userId: user.id,
          serviceTypeId: serviceType.id,
          durationMinutes: serviceType.duration_minutes,
          ...args,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [user?.id, serviceType],
  );

  /** Creates a scheduling REQUEST (admin fits the rider in) — not a booking. */
  const requestSlot = useCallback(
    async (args: { period: RequestPeriod; preferredDate?: string | null; urgent?: boolean; notes?: string }) => {
      if (!user?.id || !serviceType) throw new Error("Not ready to request");
      setSubmitting(true);
      try {
        return await createAppointmentRequest({
          userId: user.id,
          serviceTypeId: serviceType.id,
          ...args,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [user?.id, serviceType],
  );

  const hasAvailability = availability.length > 0;

  return {
    serviceTypes,
    serviceType,
    availability,
    hasAvailability,
    loading,
    loaded,
    error,
    submitting,
    refresh,
    slotsForDate,
    book,
    requestSlot,
  };
}