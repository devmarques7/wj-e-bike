import { createContext, useCallback, useContext, useEffect, useMemo, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useGarageBike,
  nextRevisionDate,
  type GarageBike,
  type HealthMetric,
} from "@/hooks/garage/useGarageBike";
import { setBikeScope } from "@/lib/ai/bikeScope";

const STORAGE_KEY = "wj.selected-bike";

interface SelectedBikeValue {
  bikes: GarageBike[];
  bike: GarageBike | null;
  bikeId: string | null;
  selectBike: (id: string) => void;
  loading: boolean;
  health: { metrics: HealthMetric[]; overall: number };
  nextRevision: Date | null;
  daysToRevision: number | null;
  refetch: () => void;
}

const SelectedBikeContext = createContext<SelectedBikeValue | null>(null);

/**
 * Single source of truth for "which bike am I looking at".
 * Every bike-scoped surface (E-Pass, My bike, next revision, urgent service,
 * appointments table and the AI assistant) reads the selection from here.
 */
export function SelectedBikeProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const urlBike = params.get("bike");
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

  const garage = useGarageBike(urlBike ?? stored);

  const selectBike = useCallback(
    (id: string) => {
      garage.selectBike(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* storage unavailable */
      }
      const next = new URLSearchParams(params);
      next.set("bike", id);
      setParams(next, { replace: true });
    },
    [garage, params, setParams],
  );

  // Keep the AI scope in sync so non-React layers know the active bike.
  useEffect(() => {
    setBikeScope(
      garage.bike
        ? {
            id: garage.bike.id,
            model: garage.bike.model,
            serial: garage.bike.serial,
            km: garage.bike.km,
            lastServiceAt: garage.bike.last_service_at,
            nextServiceAt: nextRevisionDate(garage.bike)?.toISOString().slice(0, 10) ?? null,
            servicesCompleted: garage.bike.services_completed,
          }
        : null,
    );
  }, [garage.bike]);

  const value = useMemo<SelectedBikeValue>(
    () => ({
      bikes: garage.bikes,
      bike: garage.bike,
      bikeId: garage.bike?.id ?? null,
      selectBike,
      loading: garage.loading,
      health: garage.health,
      nextRevision: garage.nextRevision,
      daysToRevision: garage.daysToRevision,
      refetch: garage.refetch,
    }),
    [garage, selectBike],
  );

  return <SelectedBikeContext.Provider value={value}>{children}</SelectedBikeContext.Provider>;
}

/** Bike-scoped state. Safe to call outside the provider (returns empty scope). */
export function useSelectedBike(): SelectedBikeValue {
  const ctx = useContext(SelectedBikeContext);
  return (
    ctx ?? {
      bikes: [],
      bike: null,
      bikeId: null,
      selectBike: () => {},
      loading: false,
      health: { metrics: [], overall: 0 },
      nextRevision: null,
      daysToRevision: null,
      refetch: () => {},
    }
  );
}
