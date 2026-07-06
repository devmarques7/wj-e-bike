import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { accessories } from "../../../data/accessories";

export default defineTool({
  name: "list_accessories",
  title: "List accessories",
  description: "List WJ Vision accessories (helmets, locks, bags, tech, etc.). Optionally filter by category.",
  inputSchema: {
    category: z
      .enum(["safety", "storage", "tech", "comfort", "protection"])
      .optional()
      .describe("Optional accessory category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category }) => {
    const items = category
      ? accessories.filter((a) => a.category === category)
      : accessories;
    const rows = items.map((a) => ({
      id: a.id,
      name: a.name,
      tagline: a.tagline,
      category: a.category,
      price_eur: a.price,
      original_price_eur: a.originalPrice,
      specs: a.specs,
      features: a.features,
      is_new: !!a.isNew,
      is_bestseller: !!a.isBestseller,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { accessories: rows, count: rows.length },
    };
  },
});