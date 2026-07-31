// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

    const { image } = await req.json();
    if (!image || typeof image !== "string") return json({ error: "image (data URL) required" }, 400);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You read QR codes from photos. Return ONLY the exact decoded payload text of the QR code. If no QR code is readable, return exactly NONE. No extra words, no formatting.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Decode the QR code in this frame. It may be small or slightly blurred." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
    if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!res.ok) return json({ error: await res.text() }, 502);

    const data = await res.json();
    const raw = (data?.choices?.[0]?.message?.content ?? "").toString().trim();
    const value = !raw || /^none$/i.test(raw) ? null : raw.replace(/^`+|`+$/g, "").trim();
    return json({ value });
  } catch (e: any) {
    return json({ error: e?.message ?? "decode failed" }, 500);
  }
});
