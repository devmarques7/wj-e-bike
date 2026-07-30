import { bikeProducts } from "@/data/products";
import { accessories } from "@/data/accessories";

export type CatalogItem = {
  id: string;
  name: string;
  tagline: string;
  price: number;
  image: string;
  type: "bike" | "accessory";
  category: string;
  features: string[];
  keywords: string[];
};

export const catalogItems: CatalogItem[] = [
  ...bikeProducts.map<CatalogItem>((b) => ({
    id: `bike:${b.id}`,
    name: b.name,
    tagline: b.tagline,
    price: b.price,
    image: b.image,
    type: "bike",
    category: b.category,
    features: b.features,
    keywords: [
      b.name,
      b.tagline,
      b.category,
      ...b.features,
      ...Object.values(b.specs),
      b.isNew ? "new" : "",
      b.isBestseller ? "bestseller popular" : "",
    ]
      .join(" ")
      .toLowerCase()
      .split(/\s+/),
  })),
  ...accessories.map<CatalogItem>((a) => ({
    id: `accessory:${a.id}`,
    name: a.name,
    tagline: a.tagline,
    price: a.price,
    image: a.image,
    type: "accessory",
    category: a.category,
    features: a.features,
    keywords: [
      a.name,
      a.tagline,
      a.category,
      ...a.features,
      ...Object.values(a.specs).filter(Boolean),
      a.isNew ? "new" : "",
      a.isBestseller ? "bestseller popular" : "",
    ]
      .join(" ")
      .toLowerCase()
      .split(/\s+/),
  })),
];

export const getCatalogItem = (id: string) => catalogItems.find((i) => i.id === id);

const STOP_WORDS = new Set([
  "a","an","the","i","im","i'm","for","to","of","and","or","my","me","is","are",
  "want","need","looking","search","find","show","something","with","that","best",
]);

/**
 * Local relevance search over the catalog — 0 AI credits.
 * Falls back to category/type matching when no keyword matches.
 */
export function searchCatalog(query: string, filters: string[] = []): CatalogItem[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9€]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const scored = catalogItems.map((item) => {
    let score = 0;
    terms.forEach((t) => {
      if (item.name.toLowerCase().includes(t)) score += 12;
      if (item.category.includes(t)) score += 8;
      if (item.tagline.toLowerCase().includes(t)) score += 5;
      if (item.keywords.some((k) => k.includes(t))) score += 4;
    });
    filters.forEach((f) => {
      if (item.type === f || item.category === f) score += 10;
      if (f === "budget" && item.price < 600) score += 8;
      if (f === "premium" && item.price >= 2500) score += 8;
    });
    return { item, score };
  });

  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const list = hits.length > 0 ? hits : scored.sort((a, b) => a.item.price - b.item.price);
  return list.slice(0, 6).map((s) => s.item);
}