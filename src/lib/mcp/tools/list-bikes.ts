import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { bikeProducts } from "@/data/products";

export default defineTool({
  name: "list_bikes",
  title: "List e-bikes",
  description: "List the WJ Vision e-bike catalog with prices, categories, and specs. Optionally filter by category.",
  inputSchema: {
    category: z
      .enum(["city", "commuter", "sport", "cargo"])
      .optional()
      .describe("Optional bike category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category }) => {
    const bikes = category
      ? bikeProducts.filter((b) => b.category === category)
      : bikeProducts;
    const rows = bikes.map((b) => ({
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      category: b.category,
      price_eur: b.price,
      original_price_eur: b.originalPrice,
      specs: b.specs,
      features: b.features,
      colors: b.colors.map((c) => c.name),
      is_new: !!b.isNew,
      is_bestseller: !!b.isBestseller,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { bikes: rows, count: rows.length },
    };
  },
});