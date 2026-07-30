// Future extension point: enrich the prompt with data from Supabase
// (products, inventory, plans, ...) before calling Gemini.
//
// Keep this file free of Gemini-specific logic — it only produces the
// extra system context string that gets prepended to the conversation.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const BASE_SYSTEM_PROMPT =
  "You are the WJ Vision assistant. Answer clearly and concisely, " +
  "in the same language the user writes in. If you don't know something, say so.";

/**
 * Builds the system context sent to the model.
 * Later: query Supabase here (products, inventory, plans) and append the
 * results so the assistant can answer using the project's own data.
 */
export async function buildSystemContext(
  _messages: ChatMessage[],
): Promise<string> {
  const parts: string[] = [BASE_SYSTEM_PROMPT];
  // const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // const { data: products } = await supabase.from("products").select("name, price").limit(20);
  // if (products?.length) parts.push("Catalog:\n" + products.map(...).join("\n"));
  return parts.join("\n\n");
}