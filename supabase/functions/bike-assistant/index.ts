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
      description: "Get the customer's appointments (upcoming and recent past), including their ids.",
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
  list_service_slots: {
    type: "function",
    function: {
      name: "list_service_slots",
      description:
        "List real free time slots for a given date and service name. Always call this before creating an appointment.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          service_name: { type: "string", description: "Service type name or keyword" },
        },
        required: ["date", "service_name"],
        additionalProperties: false,
      },
    },
  },
  create_appointment: {
    type: "function",
    function: {
      name: "create_appointment",
      description:
        "Book an appointment for the authenticated customer. Only call after the user explicitly confirmed date, time and service.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          start_time: { type: "string", description: "HH:MM (24h)" },
          service_name: { type: "string" },
          notes: { type: "string", description: "Problem description, may be empty" },
          urgent: { type: "boolean" },
        },
        required: ["date", "start_time", "service_name", "notes", "urgent"],
        additionalProperties: false,
      },
    },
  },
  reschedule_appointment: {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Move an existing appointment to a new date/time. Requires the appointment id.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          date: { type: "string" },
          start_time: { type: "string" },
        },
        required: ["appointment_id", "date", "start_time"],
        additionalProperties: false,
      },
    },
  },
  cancel_appointment: {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancel an appointment by id. Only after explicit user confirmation.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["appointment_id", "reason"],
        additionalProperties: false,
      },
    },
  },
  register_bike: {
    type: "function",
    function: {
      name: "register_bike",
      description: "Register a new bike for the customer. Serial must be unique.",
      parameters: {
        type: "object",
        properties: {
          model: { type: "string" },
          serial: { type: "string" },
          color: { type: "string" },
          km: { type: "number" },
        },
        required: ["model", "serial", "color", "km"],
        additionalProperties: false,
      },
    },
  },
  request_epass_card: {
    type: "function",
    function: {
      name: "request_epass_card",
      description:
        "Request a digital E-Pass card for one of the customer's bikes. Stays pending until an admin approves it.",
      parameters: {
        type: "object",
        properties: { bike_serial: { type: "string" } },
        required: ["bike_serial"],
        additionalProperties: false,
      },
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
  actions: [
    "list_service_slots",
    "create_appointment",
    "reschedule_appointment",
    "cancel_appointment",
    "register_bike",
    "request_epass_card",
  ],
};

async function resolveServiceType(supabase: any, name: string) {
  const { data } = await supabase
    .from("service_types")
    .select("id, name, duration_minutes, base_price, covered_by_plan_levels")
    .eq("is_active", true)
    .ilike("name", `%${name ?? ""}%`)
    .limit(1);
  return data?.[0] ?? null;
}

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
        .select("id, scheduled_date, scheduled_start_time, status, priority, duration_minutes, extra_charge_eur, is_covered_by_plan, notes, service_types(name)")
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
    case "list_service_slots": {
      const service = await resolveServiceType(supabase, args?.service_name);
      if (!service) return { error: "service_not_found" };
      const { data, error } = await supabase.rpc("get_available_slots", {
        _date: args?.date,
        _service_type_id: service.id,
        _mechanic_id: null,
      });
      if (error) return { error: error.message };
      return { service: service.name, date: args?.date, slots: (data ?? []).slice(0, 20) };
    }
    case "create_appointment": {
      if (!userId) return { error: "not_authenticated" };
      const service = await resolveServiceType(supabase, args?.service_name);
      if (!service) return { error: "service_not_found" };
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, plan_version_id, plan_versions(plans(tier_level))")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      const tier = sub?.plan_versions?.plans?.tier_level ?? 0;
      const covered = (service.covered_by_plan_levels ?? []).includes(tier);
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          user_id: userId,
          service_type_id: service.id,
          subscription_id: sub?.id ?? null,
          subscription_plan_level: tier,
          is_covered_by_plan: covered,
          extra_charge_eur: covered ? 0 : (service.base_price ?? 0),
          scheduled_date: args?.date,
          scheduled_start_time: args?.start_time,
          duration_minutes: service.duration_minutes,
          status: "pending",
          priority: args?.urgent ? "urgent" : "normal",
          booked_via: "assistant",
          notes: args?.notes || null,
        })
        .select("id, scheduled_date, scheduled_start_time")
        .single();
      if (error) return { error: error.message };
      return { created: data, service: service.name, covered_by_plan: covered };
    }
    case "reschedule_appointment": {
      if (!userId) return { error: "not_authenticated" };
      const { data, error } = await supabase
        .from("appointments")
        .update({
          scheduled_date: args?.date,
          scheduled_start_time: args?.start_time,
          status: "rescheduled",
        })
        .eq("id", args?.appointment_id)
        .eq("user_id", userId)
        .select("id, scheduled_date, scheduled_start_time")
        .maybeSingle();
      if (error) return { error: error.message };
      return data ? { rescheduled: data } : { error: "appointment_not_found" };
    }
    case "cancel_appointment": {
      if (!userId) return { error: "not_authenticated" };
      const { data, error } = await supabase
        .from("appointments")
        .update({ status: "canceled", notes: args?.reason || null })
        .eq("id", args?.appointment_id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (error) return { error: error.message };
      return data ? { canceled: data.id } : { error: "appointment_not_found" };
    }
    case "register_bike": {
      if (!userId) return { error: "not_authenticated" };
      const serial = String(args?.serial ?? "").trim();
      if (serial) {
        const { data: available } = await supabase.rpc("is_bike_serial_available", { _serial: serial });
        if (available === false) return { error: "serial_already_registered" };
      }
      const { data, error } = await supabase
        .from("customer_bikes")
        .insert({
          customer_id: userId,
          model: args?.model,
          serial: serial || null,
          color: args?.color || null,
          km: Math.max(0, Math.round(Number(args?.km) || 0)),
        })
        .select("id, model, serial")
        .single();
      if (error) return { error: error.message };
      return { registered: data };
    }
    case "request_epass_card": {
      if (!userId) return { error: "not_authenticated" };
      const { data: bike } = await supabase
        .from("customer_bikes")
        .select("id, model, serial")
        .eq("customer_id", userId)
        .ilike("serial", `%${args?.bike_serial ?? ""}%`)
        .limit(1)
        .maybeSingle();
      if (!bike) return { error: "bike_not_found" };
      const { data, error } = await supabase
        .from("epass_card_requests")
        .insert({
          user_id: userId,
          bike_id: bike.id,
          bike_serial: bike.serial,
          bike_model: bike.model,
          card_number: (bike.serial ?? bike.id).toString().toUpperCase().slice(-12),
          tier: "light",
          status: "pending",
        })
        .select("id, card_number, status")
        .single();
      if (error) return { error: error.message };
      return { requested: data };
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

    const {
      messages = [],
      skills = [],
      assistantName = "E-IA",
      tone = "concise",
      // Deterministic layer already answered these — the model only sees a summary.
      localContext = "",
      // Which bike the rider currently has selected in the dashboard.
      bikeContext = "",
      // "json" = strict JSON extraction call (diagnosis judge). No tools, no
      // chatty system prompt, and enough budget so the JSON is never truncated.
      mode = "chat",
    } = await req.json();

    // ---- token economy: only keep the recent turns, trimmed ----
    const trimmed = (messages as any[])
      .slice(-8)
      .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 2000) }));

    if (mode === "json") {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "You are a data extraction engine. Output ONLY a single valid JSON object. No prose, no markdown, no explanation.",
            },
            ...trimmed,
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
        }),
      });

      if (res.status === 429) return json({ error: "rate_limited" }, 429);
      if (res.status === 402) return json({ error: "credits_exhausted" }, 402);
      if (!res.ok) {
        const text = await res.text();
        return json({ error: "gateway_error", detail: text }, 500);
      }
      const data = await res.json();
      return json({
        content: data.choices?.[0]?.message?.content ?? "",
        source: "ai",
        usage: data.usage ?? null,
      });
    }

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

    const system = `You are ${assistantName}, the WJ e-bike assistant in the customer dashboard.
Tone: ${tone}. Reply in the user's language. Prices in EUR.
Ground every fact in tool data — never invent prices, dates, models or ids.
Be brief: max ~120 words, bullet lists, one clear next step.
Call at most one tool per turn unless strictly required, and never re-fetch data already present in this conversation.
Write actions (create/reschedule/cancel/register/request) require an explicit user confirmation in the previous message; if it is missing, ask one short confirmation question instead of calling the tool.
If the needed skill is off, say which skill to enable.${bikeContext ? `\nActive bike context: ${String(bikeContext).slice(0, 600)}` : ""}${localContext ? `\nKnown context: ${String(localContext).slice(0, 800)}` : ""}`;

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
          max_completion_tokens: 700,
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
        return json({
          content: message.content ?? "",
          source: "ai",
          usedTools: convo.filter((m) => m.role === "tool").map((m) => m.name),
          usage: data.usage ?? null,
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
            : await runTool(call.function.name, args, supabase, userId);
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