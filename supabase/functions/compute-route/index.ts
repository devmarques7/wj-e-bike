const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { origin, destination, travelMode } = await req.json();
    const apiKey =
      Deno.env.get("GOOGLE_API_KEY") ??
      Deno.env.get("GOOGLE_MAPS_API_KEY") ??
      "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!origin?.lat || !destination?.lat) {
      return new Response(JSON.stringify({ error: "invalid_coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mode = travelMode === "DRIVING" ? "DRIVE" : "BICYCLE";
    const body = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: mode,
      polylineEncoding: "ENCODED_POLYLINE",
    };
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      // Fallback to legacy Directions API (commonly enabled by default)
      const legacyMode = travelMode === "DRIVING" ? "driving" : "bicycling";
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${legacyMode}&key=${apiKey}`;
      const legacyRes = await fetch(url);
      const legacyData = await legacyRes.json();
      if (legacyData.status !== "OK" || !legacyData.routes?.[0]) {
        return new Response(
          JSON.stringify({ error: "routes_api_error", details: data, legacy: legacyData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const r = legacyData.routes[0];
      const leg = r.legs?.[0];
      return new Response(
        JSON.stringify({
          polyline: r.overview_polyline?.points ?? null,
          distanceMeters: leg?.distance?.value ?? null,
          duration: `${leg?.duration?.value ?? 0}s`,
          source: "directions_api",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const route = data.routes?.[0];
    return new Response(
      JSON.stringify({
        polyline: route?.polyline?.encodedPolyline ?? null,
        distanceMeters: route?.distanceMeters ?? null,
        duration: route?.duration ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});