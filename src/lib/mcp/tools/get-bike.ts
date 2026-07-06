import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { bikeProducts } from "@/data/products";

export default defineTool({
  name: "get_bike",
  title: "Get bike details",
  description: "Get full details for a specific WJ Vision e-bike by its id (e.g. 'vision-x1').",
  inputSchema: {
    id: z.string().min(1).describe("The bike id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ id }) => {
    const bike = bikeProducts.find((b) => b.id === id);
    if (!bike) {
      return {
        content: [{ type: "text", text: `No bike found with id "${id}".` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(bike, null, 2) }],
      structuredContent: { bike },
    };
  },
});