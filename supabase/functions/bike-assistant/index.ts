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

/** Tool definitions per skill */
const TOOL_DEFS: Record<string, any> = {
  get_my_bikes: {
    type: "function",
    function: {
      name: "get_my_bikes",
      description:
        "Get the authenticated customer's registered bikes with mileage and service dates.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  get_service_catalog: {
    type: "function",
    function: {
      name: "get_service_catalog",
      description: "List all active service types with duration, price and plan coverage.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  get_plans: {
    type: "function",
    function: {
      name: "get_plans",
      description: "List membership plans with their active version price and features.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  search_products: {
    type: "function",
    function: {
      name: "search_products",
      description: "Search accessories and parts by keyword and optional max price.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword, may be empty" },
          max_price: { type: "number", description: "Maximum price in EUR, 0 for none" },
        },
        required: ["query", "max_price"],
        additionalProperties: false,
      },
    },
  },
  search_bikes: {
    type: "function",
    function: {
      name: "search_bikes",
      description: "List bikes available in the WJ catalog with prices.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  get_my_appointments: {
    type: "function",
    function: {
      name: "get_my_appointments",
      description: "Get the customer's appointments (upcoming and recent past).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  get_favorites: {
    type: "function",
    function: {
      name: "get_favorites",
      description: "Featured and subscription-exclusive products recommended for the customer.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
};

const SKILL_TOOLS: Record<string, string[]> = {
  my_bike: ["get_my_bikes"],
  service_catalog: ["get_service_catalog"],
  pricing: ["get_plans"],
  products: ["search_products"],
  bike_catalog: ["search_bikes"],
  appointments: ["get_my_appointments"],
  favorites: ["get_favorites"],
};

async function runTool(name: string, args: any, supabase: any, userId: string | null) {
  switch (name) {
    case "get_my_bikes": {
      if (!userId) return { error: "not_authenticated" };
      const { data } = await supabase
        .from("customer_bikes")
        .select("model, serial, color, km, purchased_at, last_service_at, next_service_at, services_completed, is_active")
        .eq("customer_id", userId);
      return { bikes: data ?? [] };
    }
    case "get_service_catalog": {
      const { data } = await supabase
        .from("service_types")
        .select("name, description, duration_minutes, base_price, covered_by_plan_levels, is_emergency, reward_points")
        .eq("is_active", true)
        .order("display_order");
      return { services: data ?? [] };
    }
    case "get_plans": {
      const { data } = await supabase
        .from("plans")
        .select("name, slug, tier_level, description, plan_versions(price, currency, interval, trial_days, features, status)")
        .eq("is_active", true)
        .order("display_order");
      return { plans: data ?? [] };
    }
    case "search_products": {
      let q = supabase
        .from("products")
        .select("name, slug, short_description, base_price, sale_price, currency, product_type, is_featured")
        .eq("is_active", true)
        .neq("product_type", "bike")
        .limit(15);
      if (args?.query) q = q.ilike("name", `%${args.query}%`);
      if (args?.max_price && args.max_price > 0) q = q.lte("base_price", args.max_price);
      const { data } = await q;
      return { products: data ?? [] };
    }
    case "search_bikes": {
      let q = supabase
        .from("products")
        .select("name, slug, description, base_price, sale_price, currency, is_featured")
        .eq("is_active", true)
        .eq("product_type", "bike")
        .limit(15);
      if (args?.query) q = q.ilike("name", `%${args.query}%`);
      const { data } = await q;
      return { bikes: data ?? [] };
    }
    case "get_my_appointments": {
      if (!userId) return { error: "not_authenticated" };
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_date, scheduled_start_time, status, priority, duration_minutes, extra_charge_eur, is_covered_by_plan, notes, service_types(name)")
        .eq("user_id", userId)
        .order("scheduled_date", { ascending: false })
        .limit(15);
      return { appointments: data ?? [] };
    }
    case "get_favorites": {
      const { data } = await supabase
        .from("products")
        .select("name, slug, base_price, sale_price, currency, product_type")
        .eq("is_active", true)
        .or("is_featured.eq.true,is_subscription_exclusive.eq.true")
        .limit(12);
      return { recommendations: data ?? [] };
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

    const { messages = [], skills = [], assistantName = "E-IA", tone = "concise" } =
      await req.json();

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    const activeTools = (skills as string[])
      .flatMap((s) => SKILL_TOOLS[s] ?? [])
      .map((t) => TOOL_DEFS[t])
      .filter(Boolean);

    const system = `You are ${assistantName}, the WJ e-bike assistant inside the customer dashboard.
Tone: ${tone}. Answer in the language the user writes in.
Always use the available tools to ground answers in real data — never invent prices, dates or model names.
Prices are in EUR. Keep answers short, structured and actionable; suggest a next step when relevant.
If a needed skill is not available, say which skill the user should enable.`;

    const convo: any[] = [{ role: "system", content: system }, ...messages];

    for (let step = 0; step < 6; step++) {
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
          ...(activeTools.length ? { tools: activeTools } : {}),
        }),
      });

      if (res.status === 429) return json({ error: "rate_limited" }, 429);
      if (res.status === 402) return json({ error: "credits_exhausted" }, 402);
      if (!res.ok) {
        const text = await res.text();
        return json({ error: "gateway_error", detail: text }, 500);
      }

      const data = await res.json();
      const message = data.choices?.[0]?.message;
      if (!message) return json({ error: "empty_response" }, 500);

      const toolCalls = message.tool_calls ?? [];
      if (!toolCalls.length) {
        return json({ content: message.content ?? "", usedTools: convo.filter((m) => m.role === "tool").map((m) => m.name) });
      }

      convo.push(message);
      for (const call of toolCalls) {
        let args: any = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch (_) { /* ignore */ }
        const result = await runTool(call.function.name, args, supabase, userId);
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result).slice(0, 12000),
        });
      }
    }

    return json({ content: "I could not complete this request. Please rephrase." });
  } catch (e) {
    return json({ error: "unexpected", detail: String(e) }, 500);
  }
});