// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const TOOLS = [
  {
    type: "function",
    function: {
      name: "garage_overview",
      description:
        "Counts of bikes in the workshop for a date range: scheduled, in progress, broken/urgent, completed, plus average repair time.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "ISO date YYYY-MM-DD" },
          to: { type: "string", description: "ISO date YYYY-MM-DD" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_garage_jobs",
      description:
        "List the workshop jobs (appointments) for a date range with customer name, bike model/serial, service, status and notes.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          status: {
            type: "string",
            description:
              "Optional status filter: pending, confirmed, in_progress, completed, canceled. Empty string for all.",
          },
        },
        required: ["from", "to", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_bike",
      description:
        "Find a bike by serial, model or customer name/email. Returns the bike, its owner and service dates.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bike_briefing",
      description:
        "Full briefing for one bike: owner, mileage, service history, current job status and quality-control notes.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Serial or model" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_parts",
      description:
        "Search parts/accessories in the inventory. Returns stock per location (available, reserved, incoming) so you can say where the part is.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "low_stock_parts",
      description: "Parts at or below their reorder point / low stock threshold.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

async function ownersOf(supabase: any, userIds: string[]) {
  if (!userIds.length) return {} as Record<string, any>;
  const [{ data: profiles }, { data: bikes }] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", userIds),
    supabase
      .from("customer_bikes")
      .select("customer_id, model, serial, km, is_active")
      .in("customer_id", userIds),
  ]);
  const map: Record<string, any> = {};
  for (const p of profiles ?? []) {
    map[p.user_id] = { customer: p.full_name ?? p.email, email: p.email, phone: p.phone, bikes: [] };
  }
  for (const b of bikes ?? []) {
    map[b.customer_id] = map[b.customer_id] ?? { customer: null, bikes: [] };
    map[b.customer_id].bikes.push({ model: b.model, serial: b.serial, km: b.km, active: b.is_active });
  }
  return map;
}

async function runTool(name: string, args: any, supabase: any): Promise<any> {
  switch (name) {
    case "garage_overview": {
      const { data } = await supabase
        .from("appointments")
        .select("id, status, priority, duration_minutes, actual_duration_minutes, scheduled_date")
        .gte("scheduled_date", args.from)
        .lte("scheduled_date", args.to);
      const rows = data ?? [];
      const done = rows.filter((r: any) => r.status === "completed");
      const durations = done
        .map((r: any) => r.actual_duration_minutes)
        .filter((n: any) => typeof n === "number" && n > 0);
      return {
        range: { from: args.from, to: args.to },
        total: rows.length,
        in_garage: rows.filter((r: any) => r.status === "in_progress").length,
        for_repair: rows.filter((r: any) => r.status === "pending" || r.status === "confirmed").length,
        broken_urgent: rows.filter((r: any) => r.priority === "urgent" || r.priority === "high").length,
        fixed: done.length,
        avg_repair_minutes: durations.length
          ? Math.round(durations.reduce((s: number, n: number) => s + n, 0) / durations.length)
          : null,
      };
    }
    case "list_garage_jobs": {
      let q = supabase
        .from("appointments")
        .select(
          "id, user_id, scheduled_date, scheduled_start_time, status, priority, notes, duration_minutes, actual_duration_minutes, service_types(name)",
        )
        .gte("scheduled_date", args.from)
        .lte("scheduled_date", args.to)
        .order("scheduled_date")
        .limit(40);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const owners = await ownersOf(supabase, [...new Set((data ?? []).map((a: any) => a.user_id))] as string[]);
      return {
        jobs: (data ?? []).map((a: any) => ({
          id: a.id,
          date: a.scheduled_date,
          time: a.scheduled_start_time,
          status: a.status,
          priority: a.priority,
          service: a.service_types?.name ?? null,
          notes: a.notes,
          planned_minutes: a.duration_minutes,
          actual_minutes: a.actual_duration_minutes,
          ...(owners[a.user_id] ?? {}),
        })),
      };
    }
    case "find_bike": {
      const term = String(args.query ?? "").trim();
      const { data: bikes } = await supabase
        .from("customer_bikes")
        .select(
          "id, customer_id, model, serial, color, km, last_service_at, next_service_at, services_completed, is_active",
        )
        .or(`serial.ilike.%${term}%,model.ilike.%${term}%`)
        .limit(10);
      let rows = bikes ?? [];
      if (!rows.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id")
          .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
          .limit(5);
        const ids = (profiles ?? []).map((p: any) => p.user_id);
        if (ids.length) {
          const { data: byOwner } = await supabase
            .from("customer_bikes")
            .select(
              "id, customer_id, model, serial, color, km, last_service_at, next_service_at, services_completed, is_active",
            )
            .in("customer_id", ids)
            .limit(10);
          rows = byOwner ?? [];
        }
      }
      const owners = await ownersOf(supabase, [...new Set(rows.map((b: any) => b.customer_id))] as string[]);
      return {
        bikes: rows.map((b: any) => ({ ...b, customer: owners[b.customer_id]?.customer ?? null })),
      };
    }
    case "bike_briefing": {
      const found: any = await runTool("find_bike", args, supabase);
      const bike = found?.bikes?.[0];
      if (!bike) return { error: "bike_not_found" };
      const { data: appts } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_date, scheduled_start_time, status, priority, notes, actual_duration_minutes, service_types(name)",
        )
        .eq("user_id", bike.customer_id)
        .order("scheduled_date", { ascending: false })
        .limit(10);
      const ids = (appts ?? []).map((a: any) => a.id);
      let qc: any[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from("appointment_qc_progress")
          .select("appointment_id, stage_name, notes, completed_at, duration_seconds")
          .in("appointment_id", ids)
          .limit(30);
        qc = data ?? [];
      }
      return { bike, appointments: appts ?? [], quality_control: qc };
    }
    case "search_parts": {
      const term = String(args.query ?? "").trim();
      let pq = supabase
        .from("products")
        .select("id, name, sku_prefix, base_price, currency, product_type, short_description")
        .eq("is_active", true)
        .neq("product_type", "bike")
        .limit(10);
      if (term) pq = pq.ilike("name", `%${term}%`);
      const { data: products } = await pq;
      const productIds = (products ?? []).map((p: any) => p.id);
      if (!productIds.length) return { parts: [] };
      const { data: variants } = await supabase
        .from("product_variants")
        .select("id, product_id, sku, name")
        .in("product_id", productIds);
      const variantIds = (variants ?? []).map((v: any) => v.id);
      const stockRes = variantIds.length
        ? await supabase
            .from("inventory")
            .select(
              "variant_id, qty_available, qty_reserved, qty_incoming, low_stock_threshold, locations(name, location_type, address)",
            )
            .in("variant_id", variantIds)
        : { data: [] as any[] };
      const stock = stockRes.data ?? [];
      return {
        parts: (products ?? []).map((p: any) => ({
          name: p.name,
          price: p.base_price,
          currency: p.currency,
          description: p.short_description,
          variants: (variants ?? [])
            .filter((v: any) => v.product_id === p.id)
            .map((v: any) => ({
              sku: v.sku,
              variant: v.name,
              stock: stock
                .filter((s: any) => s.variant_id === v.id)
                .map((s: any) => ({
                  location: s.locations?.name,
                  location_type: s.locations?.location_type,
                  address: s.locations?.address,
                  available: s.qty_available,
                  reserved: s.qty_reserved,
                  incoming: s.qty_incoming,
                })),
            })),
        })),
      };
    }
    case "low_stock_parts": {
      const { data } = await supabase
        .from("inventory")
        .select(
          "qty_available, low_stock_threshold, reorder_point, product_variants(sku, name, products(name)), locations(name)",
        )
        .order("qty_available")
        .limit(25);
      return {
        low_stock: (data ?? [])
          .filter((r: any) => r.qty_available <= Math.max(r.low_stock_threshold ?? 0, r.reorder_point ?? 0))
          .map((r: any) => ({
            product: r.product_variants?.products?.name,
            sku: r.product_variants?.sku,
            variant: r.product_variants?.name,
            location: r.locations?.name,
            available: r.qty_available,
            reorder_point: r.reorder_point,
          })),
      };
    }
    default:
      return { error: `unknown_tool:${name}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "missing_api_key" }, 500);

    const { messages = [] } = await req.json();
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;
    if (!userId) return json({ error: "not_authenticated" }, 401);

    const [{ data: isStaff }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "staff" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (!isStaff && !isAdmin) return json({ error: "forbidden" }, 403);

    const trimmed = (messages as any[])
      .slice(-8)
      .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 2000) }));

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const system = `You are the WJ Workshop Garage assistant for the mechanics/staff dashboard.
Today is ${ymd(today)}; tomorrow is ${ymd(tomorrow)}.
Your only job: answer questions about the bikes in the workshop and about the parts needed to repair them.
Typical questions: how many bikes are in the garage, which bike belongs to which customer, does a customer have a bike here today, what is the serial/number of a bike, what is the briefing/history of a bike, what needs repair, which part is required, where that part is stored and whether it is in stock.
Ground every fact in tool data — never invent serials, customers, quantities, locations or dates.
Be brief and operational: short bullets, include serial, customer, status and stock location when relevant.
If nothing is found, say it plainly and suggest the next check. Reply in the user's language.`;

    const convo: any[] = [{ role: "system", content: system }, ...trimmed];

    let toolCallCount = 0;
    for (let step = 0; step < 4; step++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: convo,
          max_completion_tokens: 800,
          tools: TOOLS,
        }),
      });

      if (res.status === 429) return json({ error: "rate_limited" }, 429);
      if (res.status === 402) return json({ error: "credits_exhausted" }, 402);
      if (!res.ok) return json({ error: "gateway_error", detail: await res.text() }, 500);

      const data = await res.json();
      const message = data.choices?.[0]?.message;
      if (!message) return json({ error: "empty_response" }, 500);

      const toolCalls = message.tool_calls ?? [];
      if (!toolCalls.length) {
        return json({
          content: message.content ?? "",
          usedTools: convo.filter((m) => m.role === "tool").map((m) => m.name),
        });
      }

      convo.push(message);
      for (const call of toolCalls) {
        toolCallCount++;
        let args: any = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch (_) { /* ignore */ }
        const result =
          toolCallCount > 6
            ? { error: "tool_budget_exceeded" }
            : await runTool(call.function.name, args, supabase);
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result).slice(0, 6000),
        });
      }
    }

    return json({ content: "I could not complete this request. Please rephrase." });
  } catch (e) {
    return json({ error: "unexpected", detail: String(e) }, 500);
  }
});