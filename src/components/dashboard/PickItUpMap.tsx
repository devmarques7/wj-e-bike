import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2, AlertTriangle, Bike, Car, Navigation2 } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { supabase } from "@/integrations/supabase/client";

type PickupPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  notes: string | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1));
}

export default function PickItUpMap() {
  const { ready, error, hasKey } = useGoogleMaps(["places"]);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  const [places, setPlaces] = useState<PickupPlace[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [distanceInfo, setDistanceInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [travelMode, setTravelMode] = useState<"BICYCLING" | "DRIVING">("BICYCLING");
  const [routeRequested, setRouteRequested] = useState(false);

  // Load places
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pickup_places")
        .select("*")
        .eq("is_active", true);
      setPlaces((data as PickupPlace[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Ask user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocError("We couldn't get your location. Showing all pickup places."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const startRoute = () => {
    setLocError(null);
    // Force select HQ if available
    const hq = places.find((p) => p.is_headquarters) ?? targetPlace;
    if (hq) setSelectedId(hq.id);
    if (!navigator.geolocation) {
      setLocError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setRouteRequested(true);
      },
      () => setLocError("We couldn't get your location to draw the route."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Nearest / only place logic
  const targetPlace = useMemo(() => {
    if (!places.length) return null;
    if (places.length === 1) return places[0];
    const hq = places.find((p) => p.is_headquarters);
    if (!userLoc) return hq ?? places[0];
    const withDist = places.map((p) => ({
      p,
      d: haversineKm(userLoc, { lat: p.latitude, lng: p.longitude }),
    }));
    withDist.sort((a, b) => a.d - b.d);
    return withDist[0].p;
  }, [places, userLoc]);

  useEffect(() => {
    if (targetPlace && !selectedId) setSelectedId(targetPlace.id);
  }, [targetPlace, selectedId]);

  // Init map
  useEffect(() => {
    if (!ready || !mapRef.current || !places.length) return;
    const google = (window as any).google;
    const center = userLoc ?? { lat: places[0].latitude, lng: places[0].longitude };
    mapInstance.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0b1418" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0b1418" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#6b7d80" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2a2f" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#050d0f" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ],
    });

    // User marker
    if (userLoc) {
      new google.maps.Marker({
        position: userLoc,
        map: mapInstance.current,
        title: "You are here",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 7,
        },
      });
    }

    // Place markers
    places.forEach((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        map: mapInstance.current,
        title: p.name,
        icon: {
          path: "M12 2C7 2 3 6 3 11c0 7 9 13 9 13s9-6 9-13c0-5-4-9-9-9z",
          fillColor: p.is_headquarters ? "#058c42" : "#0aa851",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 1.5,
          scale: 1.4,
          anchor: new google.maps.Point(12, 24),
        },
      });
      marker.addListener("click", () => setSelectedId(p.id));
    });
  }, [ready, places, userLoc]);

  // Route from user to selected
  useEffect(() => {
    if (!ready || !mapInstance.current || !userLoc || !selectedId) return;
    const place = places.find((p) => p.id === selectedId);
    if (!place) return;
    const google = (window as any).google;
    if (!directionsRenderer.current) {
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#058c42", strokeWeight: 4, strokeOpacity: 0.9 },
      });
      directionsRenderer.current.setMap(mapInstance.current);
    }
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: userLoc,
        destination: { lat: place.latitude, lng: place.longitude },
        travelMode: google.maps.TravelMode[travelMode],
      },
      (res: any, status: string) => {
        if (status === "OK" && res) {
          directionsRenderer.current.setDirections(res);
          const leg = res.routes[0]?.legs[0];
          if (leg) setDistanceInfo({ distance: leg.distance.text, duration: leg.duration.text });
        }
      }
    );
  }, [ready, userLoc, selectedId, places, travelMode]);

  const openInMaps = () => {
    const place = places.find((p) => p.id === selectedId) ?? targetPlace;
    if (!place) return;
    const origin = userLoc ? `${userLoc.lat},${userLoc.lng}` : "";
    const dest = `${place.latitude},${place.longitude}`;
    const mode = travelMode === "DRIVING" ? "driving" : "bicycling";
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${mode}`;
    window.open(url, "_blank");
  };

  if (!hasKey) {
    return (
      <div className="rounded-2xl border border-wj-green/20 bg-wj-green/5 p-6 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-wj-green shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-foreground font-medium">Map unavailable</p>
          <p className="text-muted-foreground text-xs mt-1">
            Configure <code className="text-wj-green">VITE_GOOGLE_MAPS_API_KEY</code> in your environment to enable the Pick-It-Up map.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/20 bg-muted/10 p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-wj-green animate-spin" />
      </div>
    );
  }

  if (!places.length) {
    return (
      <div className="rounded-2xl border border-border/20 bg-muted/10 p-6 text-sm text-muted-foreground">
        No pickup places registered yet.
      </div>
    );
  }

  const selectedPlace = places.find((p) => p.id === selectedId) ?? targetPlace!;
  const onlyOne = places.length === 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.2em] text-wj-green font-medium">
          Pick-It-Up Places
        </h2>
        {onlyOne && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Routing to our office
          </span>
        )}
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-wj-green/20 bg-wj-green/5">
        <div ref={mapRef} className="w-full h-[300px]" />
        {(!ready || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs text-muted-foreground">
            {error ? "Failed to load map" : <Loader2 className="h-5 w-5 animate-spin text-wj-green" />}
          </div>
        )}
        {userLoc && selectedId && (
          <div className="absolute top-3 left-3 flex items-center gap-1 p-1 rounded-full bg-background/80 backdrop-blur border border-wj-green/20 shadow-lg">
            <button
              onClick={() => setTravelMode("BICYCLING")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                travelMode === "BICYCLING"
                  ? "bg-wj-green/20 text-wj-green"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Route by bike"
            >
              <Bike className="h-3.5 w-3.5" /> Bike
            </button>
            <button
              onClick={() => setTravelMode("DRIVING")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                travelMode === "DRIVING"
                  ? "bg-wj-green/20 text-wj-green"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Route by car"
            >
              <Car className="h-3.5 w-3.5" /> Car
            </button>
          </div>
        )}
        <button
          onClick={startRoute}
          className="absolute top-3 right-3 h-10 w-10 rounded-full bg-background/80 backdrop-blur border border-wj-green/30 hover:border-wj-green/60 hover:bg-wj-green/10 shadow-lg flex items-center justify-center text-wj-green transition-all"
          title="Route to WJ HQ"
          aria-label="Start route to WJ HQ"
        >
          <Navigation2 className="h-4 w-4" />
        </button>
        {distanceInfo && userLoc && selectedId && (
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur border border-wj-green/20 shadow-lg text-[11px] text-foreground">
            <span className="text-wj-green font-medium">{distanceInfo.distance}</span>
            <span className="text-muted-foreground"> • {distanceInfo.duration}</span>
          </div>
        )}
      </div>

      {locError && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {locError}
        </p>
      )}


      {places.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {places.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`text-left p-3 rounded-xl border transition-all ${
                selectedId === p.id
                  ? "border-wj-green/60 bg-wj-green/10"
                  : "border-border/20 bg-muted/5 hover:border-wj-green/30"
              }`}
            >
              <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{p.address}</p>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}