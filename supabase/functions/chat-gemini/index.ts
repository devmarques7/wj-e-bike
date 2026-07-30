import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { buildSystemContext, type ChatMessage } from "./context.ts";

const MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isValidMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== "object") return false;
  const { role, content } = m as Record<string, unknown>;
  return (
    (role === "user" || role === "assistant") &&
    typeof content === "string" &&
    content.trim().length > 0 &&
    content.length <= 8000
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json(
      { error: "GEMINI_API_KEY is not configured. Add the secret to enable the chat." },
      500,
    );
  }

  let payload: { messages?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const raw = payload?.messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50 || !raw.every(isValidMessage)) {
    return json(
      { error: "`messages` must be an array (1-50) of { role: 'user'|'assistant', content: string }." },
      400,
    );
  }
  const messages = raw as ChatMessage[];

  const systemInstruction = await buildSystemContext(messages);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`Gemini request failed [${res.status}]: ${details}`);
      if (res.status === 429) {
        return json(
          { error: "Free request limit reached. Please try again in a minute." },
          429,
        );
      }
      if (res.status === 400 || res.status === 403) {
        return json({ error: "The Gemini API rejected the request. Check the API key.", details }, res.status);
      }
      return json({ error: "The AI service is unavailable right now.", details }, 502);
    }

    const data = await res.json();
    const reply: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text ?? "")
        .join("")
        .trim() ?? "";

    if (!reply) {
      console.error("Empty Gemini response:", JSON.stringify(data).slice(0, 800));
      return json({ error: "The model returned an empty answer. Please try again." }, 502);
    }

    return json({ reply });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    console.error("chat-gemini failure:", err);
    return json(
      { error: aborted ? "The request timed out. Please try again." : "Could not reach the AI service." },
      504,
    );
  } finally {
    clearTimeout(timeout);
  }
});