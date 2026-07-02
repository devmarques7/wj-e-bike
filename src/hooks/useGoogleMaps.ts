import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global promise so the script is loaded only once.
let loadPromise: Promise<any> | null = null;

let cachedKey: string | null = null;
async function fetchApiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const inline = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ??
    import.meta.env.VITE_GOOGLE_API_KEY) as string | undefined;
  if (inline) {
    cachedKey = inline;
    return inline;
  }
  const { data, error } = await supabase.functions.invoke("get-maps-config");
  if (error) throw error;
  cachedKey = (data as any)?.apiKey ?? "";
  return cachedKey;
}

function loadGoogleMaps(apiKey: string, libraries: string[]): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const cbName = `__gmapsCb_${Date.now()}`;
    (window as any)[cbName] = () => {
      resolve((window as any).google);
      delete (window as any)[cbName];
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      libraries: libraries.join(","),
      loading: "async",
      callback: cbName,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function useGoogleMaps(libraries: string[] = ["places", "marker"]) {
  const [state, setState] = useState<{ ready: boolean; error: string | null; hasKey: boolean }>({
    ready: false,
    error: null,
    hasKey: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetchApiKey()
      .then((key) => {
        if (cancelled) return;
        if (!key) {
          setState((s) => ({ ...s, hasKey: false, error: "missing_api_key" }));
          return;
        }
        return loadGoogleMaps(key, libraries).then(() => {
          if (!cancelled) setState((s) => ({ ...s, ready: true }));
        });
      })
      .catch((e) => {
        if (!cancelled)
          setState((s) => ({ ...s, error: e?.message ?? "load_failed" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}