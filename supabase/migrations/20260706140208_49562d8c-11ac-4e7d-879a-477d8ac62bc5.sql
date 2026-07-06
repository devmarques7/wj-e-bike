-- plans: revoke blanket table SELECT then re-grant per-column excluding stripe_product_id
REVOKE SELECT ON public.plans FROM anon, authenticated;
GRANT SELECT (
  id, name, slug, tier_level, description, color_hex, icon,
  display_order, is_active, created_at, updated_at, is_default
) ON public.plans TO anon, authenticated;

-- plan_versions: revoke blanket table SELECT then re-grant per-column excluding stripe_price_id
REVOKE SELECT ON public.plan_versions FROM anon, authenticated;
GRANT SELECT (
  id, plan_id, version_number, price, currency, interval, trial_days,
  features, status, effective_from, created_at,
  urgent_service_included, urgent_service_fee
) ON public.plan_versions TO anon, authenticated;

-- keep service_role unrestricted
GRANT ALL ON public.plans TO service_role;
GRANT ALL ON public.plan_versions TO service_role;