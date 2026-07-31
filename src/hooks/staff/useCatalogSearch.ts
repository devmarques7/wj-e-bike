import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CatalogHit = {
  key: string;
  kind: "product" | "service";
  id: string;
  name: string;
  subtitle: string;
  price: number;
  sku?: string | null;
  stock?: number | null;
  location?: string | null;
};

/** Search products (with variants + stock) and services from the catalog. */
export function useCatalogSearch(term: string) {
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const q = term.trim();

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const like = `%${q}%`;
      const productQuery = supabase
        .from("products")
        .select(
          `id, name, base_price, sale_price, product_type, is_active,
           variants:product_variants(id, sku, name, price_override, is_active,
             inventory(qty_available, location:locations(name)))`,
        )
        .eq("is_active", true)
        .order("name")
        .limit(20);

      const serviceQuery = supabase
        .from("service_types")
        .select("id, name, description, base_price, duration_minutes, is_active")
        .eq("is_active", true)
        .order("display_order")
        .limit(20);

      const [{ data: products }, { data: services }] = await Promise.all([
        q ? productQuery.ilike("name", like) : productQuery,
        q ? serviceQuery.ilike("name", like) : serviceQuery,
      ]);

      const productHits: CatalogHit[] = [];
      (products ?? []).forEach((p: any) => {
        const variants = (p.variants ?? []).filter((v: any) => v.is_active);
        if (variants.length === 0) {
          productHits.push({
            key: `product:${p.id}`,
            kind: "product",
            id: p.id,
            name: p.name,
            subtitle: p.product_type,
            price: Number(p.sale_price ?? p.base_price ?? 0),
            stock: null,
          });
          return;
        }
        variants.forEach((v: any) => {
          const inv = v.inventory ?? [];
          const stock = inv.reduce((s: number, i: any) => s + (i.qty_available ?? 0), 0);
          productHits.push({
            key: `variant:${v.id}`,
            kind: "product",
            id: v.id,
            name: `${p.name}${v.name && v.name !== p.name ? ` · ${v.name}` : ""}`,
            subtitle: p.product_type,
            price: Number(v.price_override ?? p.sale_price ?? p.base_price ?? 0),
            sku: v.sku,
            stock,
            location: inv[0]?.location?.name ?? null,
          });
        });
      });

      const serviceHits: CatalogHit[] = (services ?? []).map((s: any) => ({
        key: `service:${s.id}`,
        kind: "service",
        id: s.id,
        name: s.name,
        subtitle: `${s.duration_minutes ?? 0} min service`,
        price: Number(s.base_price ?? 0),
      }));

      setHits([...productHits, ...serviceHits]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [run]);

  return { hits, loading, refresh: run };
}

export type CustomerOption = { id: string; user_id: string; name: string; email?: string | null };
export type BikeOption = { id: string; label: string };

/** Customers + their bikes, used to address a basket to a client/bike. */
export function useCustomerTargets() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [bikes, setBikes] = useState<Record<string, BikeOption[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: cps }, { data: bikeRows }] = await Promise.all([
          supabase.from("customer_profiles").select("id, user_id").limit(1000),
          supabase
            .from("customer_bikes")
            .select("id, customer_id, model, serial")
            .eq("is_active", true),
        ]);
        const ids = (cps ?? []).map((c) => c.user_id);
        const { data: profiles } = ids.length
          ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
          : { data: [] as any[] };

        const byUser = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        setCustomers(
          (cps ?? [])
            .map((c) => {
              const p = byUser.get(c.user_id);
              return {
                id: c.id,
                user_id: c.user_id,
                name: p?.full_name || p?.email || "Unnamed member",
                email: p?.email ?? null,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name)),
        );

        const grouped: Record<string, BikeOption[]> = {};
        (bikeRows ?? []).forEach((b: any) => {
          (grouped[b.customer_id] ||= []).push({
            id: b.id,
            label: `${b.model}${b.serial ? ` · ${b.serial}` : ""}`,
          });
        });
        setBikes(grouped);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return useMemo(() => ({ customers, bikes, loading }), [customers, bikes, loading]);
}
