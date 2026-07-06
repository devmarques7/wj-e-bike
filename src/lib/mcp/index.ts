import { defineMcp } from "@lovable.dev/mcp-js";
import listBikesTool from "./tools/list-bikes";
import getBikeTool from "./tools/get-bike";
import listAccessoriesTool from "./tools/list-accessories";

export default defineMcp({
  name: "wj-vision-mcp",
  title: "WJ Vision E-Bikes",
  version: "0.1.0",
  instructions:
    "Tools for browsing the WJ Vision e-bike and accessory catalog. Use `list_bikes` to browse bikes (optionally by category), `get_bike` for full specs of one bike by id, and `list_accessories` to browse accessories.",
  tools: [listBikesTool, getBikeTool, listAccessoriesTool],
});