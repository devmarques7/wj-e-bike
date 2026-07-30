import { supabase } from "@/integrations/supabase/client";
import type { AssistantSkillId } from "./skills";
import { matchSymptom, type SymptomId } from "./diagnosis";

/**
 * Deterministic (zero-token) intent layer.
 *
 * Every prompt goes through this router FIRST. When an intent matches, the
 * answer is built locally from live Supabase data — no AI credits are spent.
 * Only when nothing matches do we escalate to the Gemini edge function, which
 * can then reason, use tools and perform CRUD actions.
 */

export type AssistantAction =
  | { type: "navigate"; to: string; label: string }
  | { type: "diagnose"; label: string; symptom?: SymptomId }
  | { type: "external"; href: string; label: string };

export interface LocalAnswer {
  content: string;
  action?: AssistantAction;
  source: "local";
  skill?: AssistantSkillId | "routing";
}

interface IntentContext {
  userId: string | null;
  enabledSkills: AssistantSkillId[];
  assistantName: string;
}

const eur = (v: number | null | undefined, currency = "EUR") =>
  v === null || v === undefined ? "—" : `${currency === "EUR" ? "€" : currency + " "}${Number(v).toFixed(2)}`;

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

/** Extract a "under €X" / "até 100" price cap. */
function extractMaxPrice(text: string): number | null {
  const m = text.match(/(?:under|below|less than|abaixo de|até|ate|max(?:imum)?)\s*€?\s*(\d+(?:[.,]\d+)?)/i);
  if (m) return Number(m[1].replace(",", "."));
  const m2 = text.match(/€\s*(\d+(?:[.,]\d+)?)/);
  return m2 ? Number(m2[1].replace(",", ".")) : null;
}

/** Extract a product keyword from a search phrase. */
function extractKeyword(text: string): string {
  const stop = new Set([
    "show","me","find","search","looking","for","i","want","need","a","an","the","some","under","below","less","than","euros","eur","price","cheap","best","quero","procuro","mostre","me","um","uma","os","as","de","do","da","por","abaixo","até","ate","preço","preco",
  ]);
  return text
    .replace(/[€\d.,]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w))
    .slice(0, 3)
    .join(" ")
    .trim();
}

function skillOff(skill: AssistantSkillId, ctx: IntentContext): LocalAnswer | null {
  if (ctx.enabledSkills.includes(skill)) return null;
  return {
    source: "local",
    skill: "routing",
    content: `That question needs the **${skill.replace(/_/g, " ")}** skill, which is currently off. Enable it in the skill chips below and ask me again.`,
  };
}

/* ------------------------------------------------------------------ */
/* Resolvers                                                           */
/* ------------------------------------------------------------------ */

async function myBike(ctx: IntentContext): Promise<LocalAnswer | null> {
  if (!ctx.userId) return null;
  const { data } = await supabase
    .from("customer_bikes")
    .select("model, serial, color, km, last_service_at, next_service_at, services_completed")
    .eq("customer_id", ctx.userId)
    .eq("is_active", true)
    .limit(3);

  if (!data?.length) {
    return {
      source: "local",
      skill: "my_bike",
      content: "You don't have a bike registered yet. Register your frame serial to unlock service history and predictive care.",
      action: { type: "navigate", to: "/dashboard/e-pass", label: "Register my bike" },
    };
  }

  const lines = data.map((b) => {
    const next = b.next_service_at ? new Date(b.next_service_at) : null;
    const days = next ? Math.ceil((next.getTime() - Date.now()) / 86_400_000) : null;
    return [
      `**${b.model}**${b.serial ? ` · ${b.serial}` : ""}`,
      `· ${b.km ?? 0} km · ${b.services_completed ?? 0} services completed`,
      b.last_service_at ? `· Last service: ${b.last_service_at}` : null,
      next
        ? `· Next revision: ${b.next_service_at}${days !== null ? ` (${days >= 0 ? `in ${days} days` : `${Math.abs(days)} days overdue`})` : ""}`
        : "· Next revision: not scheduled",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const overdue = data.some((b) => b.next_service_at && new Date(b.next_service_at).getTime() < Date.now());
  return {
    source: "local",
    skill: "my_bike",
    content: lines.join("\n\n"),
    action: overdue
      ? { type: "navigate", to: "/dashboard/service", label: "Book the revision" }
      : undefined,
  };
}

async function myAppointments(ctx: IntentContext): Promise<LocalAnswer | null> {
  if (!ctx.userId) return null;
  const { data } = await supabase
    .from("appointments")
    .select("scheduled_date, scheduled_start_time, status, is_covered_by_plan, extra_charge_eur, service_types(name)")
    .eq("user_id", ctx.userId)
    .order("scheduled_date", { ascending: false })
    .limit(6);

  if (!data?.length) {
    return {
      source: "local",
      skill: "appointments",
      content: "You have no appointments yet.",
      action: { type: "navigate", to: "/dashboard/service", label: "Schedule a service" },
    };
  }

  const rows = data.map((a: any) => {
    const name = a.service_types?.name ?? "Service";
    const cover = a.is_covered_by_plan ? "covered by plan" : eur(a.extra_charge_eur);
    return `· ${a.scheduled_date} ${String(a.scheduled_start_time).slice(0, 5)} — **${name}** (${a.status}, ${cover})`;
  });

  return {
    source: "local",
    skill: "appointments",
    content: `Your latest appointments:\n${rows.join("\n")}`,
    action: { type: "navigate", to: "/dashboard/service", label: "Manage appointments" },
  };
}

async function plans(): Promise<LocalAnswer> {
  const { data } = await supabase
    .from("plans")
    .select("name, tier_level, description, plan_versions(price, currency, interval, status)")
    .eq("is_active", true)
    .order("display_order");

  const rows = (data ?? []).map((p: any) => {
    const active = (p.plan_versions ?? []).find((v: any) => v.status === "active");
    return `· **${p.name}** — ${active ? `${eur(active.price, active.currency)} / ${active.interval}` : "price on request"}${p.description ? `\n  ${p.description}` : ""}`;
  });

  return {
    source: "local",
    skill: "pricing",
    content: rows.length ? `Membership plans:\n${rows.join("\n")}` : "No active plans right now.",
    action: { type: "navigate", to: "/membership-plans", label: "Compare plans" },
  };
}

async function serviceCatalog(): Promise<LocalAnswer> {
  const { data } = await supabase
    .from("service_types")
    .select("name, duration_minutes, base_price, covered_by_plan_levels, is_emergency")
    .eq("is_active", true)
    .order("display_order")
    .limit(12);

  const rows = (data ?? []).map(
    (s: any) =>
      `· **${s.name}** — ${s.duration_minutes} min · ${s.base_price ? eur(s.base_price) : "included"}${
        s.covered_by_plan_levels?.length ? ` · covered on tier ${s.covered_by_plan_levels.join(", ")}` : ""
      }${s.is_emergency ? " · emergency" : ""}`,
  );

  return {
    source: "local",
    skill: "service_catalog",
    content: rows.length ? `Available services:\n${rows.join("\n")}` : "No services published.",
    action: { type: "navigate", to: "/dashboard/service", label: "Book a service" },
  };
}

async function products(text: string, bikesOnly: boolean): Promise<LocalAnswer> {
  const maxPrice = extractMaxPrice(text);
  const keyword = extractKeyword(text);

  let q = supabase
    .from("products")
    .select("name, slug, base_price, sale_price, currency, product_type")
    .eq("is_active", true)
    .limit(8);
  q = bikesOnly ? q.eq("product_type", "bike") : q.neq("product_type", "bike");
  if (keyword) q = q.ilike("name", `%${keyword}%`);
  if (maxPrice) q = q.lte("base_price", maxPrice);

  const { data } = await q;
  if (!data?.length) return { source: "local", skill: bikesOnly ? "bike_catalog" : "products", content: "" };

  const rows = data.map(
    (p: any) => `· **${p.name}** — ${eur(p.sale_price ?? p.base_price, p.currency)}`,
  );
  return {
    source: "local",
    skill: bikesOnly ? "bike_catalog" : "products",
    content: `${bikesOnly ? "Bikes" : "Products"}${keyword ? ` matching “${keyword}”` : ""}${maxPrice ? ` under ${eur(maxPrice)}` : ""}:\n${rows.join("\n")}`,
    action: { type: "navigate", to: bikesOnly ? "/gallery" : "/accessories", label: "Open catalog" },
  };
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export async function resolveLocalIntent(
  prompt: string,
  ctx: IntentContext,
): Promise<LocalAnswer | null> {
  const t = prompt.toLowerCase().trim();
  if (!t) return null;

  /* ================================================================
   * PRIORITY 1 — book a revision / repair with a guided diagnosis
   * ================================================================ */
  const wantsBooking = has(
    t, "book", "schedule", "scheduling", "marcar", "agendar", "agendamento", "revision", "revisão", "revisao",
    "repair", "reparo", "conserto", "fix", "arrumar", "consertar", "maintenance", "manutenção", "manutencao",
  );
  const symptom = matchSymptom(t);

  if (wantsBooking) {
    return {
      source: "local",
      skill: "routing",
      content: symptom
        ? `Let's get **${symptom.label.toLowerCase()}** fixed. I'll ask a few quick questions, build a repair briefing for the mechanic and then open the booking with the right service pre-selected.`
        : "Let's book your revision. First I'll run a short diagnosis so the mechanic already knows what to look at — it takes about 30 seconds.",
      action: { type: "diagnose", label: "Start diagnosis & book", symptom: symptom?.id },
    };
  }

  /* ================================================================
   * PRIORITY 2 — help with a bike problem (self-help first)
   * ================================================================ */
  if (symptom) {
    const checks = symptom.quickChecks.map((c) => `· ${c}`).join("\n");
    return {
      source: "local",
      skill: "my_bike",
      content: `Sounds like a **${symptom.label.toLowerCase()}** issue. Try this first:\n${checks}\n\nIf it doesn't help, I'll run a full diagnosis and book the repair for you.`,
      action: { type: "diagnose", label: "Run full diagnosis", symptom: symptom.id },
    };
  }

  /* --- conversational / routing intents (no data, no tokens) --- */
  if (/^(hi|hey|hello|ola|olá|oi|bom dia|boa tarde|good morning)\b/.test(t)) {
    return {
      source: "local",
      skill: "routing",
      content: `Hi! I'm ${ctx.assistantName}. I can check your bike, your appointments, plans, prices and the catalog — and I can book, reschedule or register things for you. What do you need?`,
    };
  }

  if (has(t, "what can you do", "o que você faz", "o que voce faz", "help me", "suas skills", "your skills")) {
    return {
      source: "local",
      skill: "routing",
      content:
        "Here's how I help, in order:\n1. Diagnose a problem and book the revision with a full repair briefing for the mechanic\n2. Troubleshoot your bike with step-by-step fixes\n3. Find the product or part that solves the problem\n4. Check if your plan covers it — or a better plan that does\n5. Show new bikes and gear worth upgrading to",
      action: { type: "diagnose", label: "Diagnose my bike" },
    };
  }

  if (has(t, "urgent", "emergency", "urgente", "emergência", "emergencia", "quebrou", "broken", "stuck", "não funciona", "nao funciona")) {
    return {
      source: "local",
      skill: "routing",
      content: "That sounds urgent. The Urgent Service centre puts you in the priority queue and can arrange a pickup.",
      action: { type: "navigate", to: "/dashboard/urgent-service", label: "Open Urgent Service" },
    };
  }

  if (has(t, "e-pass", "epass", "card", "cartão", "cartao", "wallet", "carteira")) {
    return {
      source: "local",
      skill: "routing",
      content: "Your E-Pass holds a unique card per registered bike. New cards need admin approval and stay in ghost mode until approved.",
      action: { type: "navigate", to: "/dashboard/e-pass", label: "Open my E-Pass" },
    };
  }

  if (has(t, "address", "where are you", "endereço", "endereco", "find us", "hq", "office", "loja")) {
    return {
      source: "local",
      skill: "routing",
      content: "WJ HQ is where all services are performed. Open the map to get turn-by-turn directions by bike or car.",
      action: { type: "navigate", to: "/dashboard/urgent-service", label: "Open the map" },
    };
  }

  /* --- data intents --- */
  if (has(t, "my bike", "minha bike", "minha bicicleta", "next revision", "next service", "próxima revisão", "proxima revisao", "km", "mileage", "how is my")) {
    return skillOff("my_bike", ctx) ?? (await myBike(ctx));
  }

  if (has(t, "appointment", "agendamento", "agendado", "scheduled", "booking", "marcado")) {
    if (has(t, "book", "schedule", "marcar", "agendar", "new ", "nova", "novo")) {
      return {
        source: "local",
        skill: "routing",
        content: "Let's schedule it. The booking flow checks your plan coverage and shows the real free slots per mechanic.",
        action: { type: "navigate", to: "/dashboard/service", label: "Open scheduling" },
      };
    }
    return skillOff("appointments", ctx) ?? (await myAppointments(ctx));
  }

  if (has(t, "plan", "plano", "membership", "assinatura", "subscription", "tier", "cover", "covered", "coberto", "cobertura")) {
    const res = skillOff("pricing", ctx) ?? (await plans());
    if (has(t, "cover", "covered", "coberto", "cobertura", "upgrade")) {
      return {
        ...res,
        content: `${res.content}\n\nIf your current tier doesn't cover the service you need, upgrading usually costs less than paying it out of pocket.`,
        action: { type: "navigate", to: "/dashboard/membership", label: "Compare & upgrade" },
      };
    }
    return res;
  }

  if (has(t, "service", "serviço", "servico", "maintenance", "manutenção", "manutencao", "revision", "revisão")) {
    return skillOff("service_catalog", ctx) ?? (await serviceCatalog());
  }

  if (has(t, "bike catalog", "which bike", "upgrade", "new bike", "nova bike", "comprar bike")) {
    const res = skillOff("bike_catalog", ctx) ?? (await products(t, true));
    if (res.content) return res;
    return null;
  }

  if (
    has(t, "light", "lock", "helmet", "rack", "accessory", "accessories", "part", "tyre", "tire", "battery", "acessório", "acessorio", "peça", "peca", "capacete", "luz") ||
    /(show|find|procuro|mostre).*(€|under|abaixo)/.test(t)
  ) {
    const res = skillOff("products", ctx) ?? (await products(t, false));
    if (res.content) return res;
    return null;
  }

  // No deterministic match → escalate to the AI.
  return null;
}