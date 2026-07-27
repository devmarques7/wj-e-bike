import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SearchCategory = "customers" | "services" | "products" | "plans";

export interface SearchResult {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle?: string;
  value?: string;
  link: string;
}

const fmtEur = (n: number | null | undefined) =>
  n == null ? undefined : new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(Number(n));

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const like = `%${term}%`;
      const [customers, services, products, plans] = await Promise.all([
        supabase.from("profiles").select("id, user_id, full_name, email, phone")
          .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(6),
        supabase.from("service_types").select("id, name, slug, base_price, duration_minutes")
          .ilike("name", like).limit(6),
        supabase.from("products").select("id, name, slug, base_price, sale_price, product_type")
          .or(`name.ilike.${like},slug.ilike.${like},sku_prefix.ilike.${like}`).limit(6),
        supabase.from("plans").select("id, name, slug, tier_level, plan_versions(price, currency, status)")
          .ilike("name", like).limit(6),
      ]);

      if (cancelled) return;

      const out: SearchResult[] = [];
      (customers.data ?? []).forEach((c: any) =>
        out.push({
          id: `customer-${c.id}`,
          category: "customers",
          title: c.full_name || c.email || "Unnamed customer",
          subtitle: c.email ?? c.phone ?? undefined,
          link: `/dashboard/admin/crm/${c.user_id}`,
        }));
      (services.data ?? []).forEach((s: any) =>
        out.push({
          id: `service-${s.id}`,
          category: "services",
          title: s.name,
          subtitle: `${s.duration_minutes} min`,
          value: fmtEur(s.base_price),
          link: `/dashboard/admin/manage`,
        }));
      (products.data ?? []).forEach((p: any) =>
        out.push({
          id: `product-${p.id}`,
          category: "products",
          title: p.name,
          subtitle: p.product_type,
          value: fmtEur(p.sale_price ?? p.base_price),
          link: `/dashboard/admin/inventory/products/${p.id}`,
        }));
      (plans.data ?? []).forEach((p: any) => {
        const active = (p.plan_versions ?? []).find((v: any) => v.status === "active") ?? p.plan_versions?.[0];
        out.push({
          id: `plan-${p.id}`,
          category: "plans",
          title: p.name,
          subtitle: `Tier ${p.tier_level}`,
          value: fmtEur(active?.price),
          link: `/dashboard/admin/plans/${p.id}`,
        });
      });

      setResults(out);
      setLoading(false);
    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [term]);

  const counts = useMemo(() => {
    return results.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [results]);

  return { results, counts, loading, hasQuery: term.length >= 2 };
}
