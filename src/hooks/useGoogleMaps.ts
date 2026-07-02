import { useEffect, useState } from "react";

// Global promise so the script is loaded only once.
let loadPromise: Promise<any> | null = null;

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
  const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY ??
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY) as string | undefined;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setError("missing_api_key");
      return;
    }
    loadGoogleMaps(apiKey, libraries)
      .then(() => setReady(true))
      .catch((e) => setError(e.message ?? "load_failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return { ready, error, hasKey: Boolean(apiKey) };
}