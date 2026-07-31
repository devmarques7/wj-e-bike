DROP POLICY IF EXISTS "pv_read_all" ON public.plan_versions;
DROP POLICY IF EXISTS "pv_read_authenticated" ON public.plan_versions;
CREATE POLICY "pv_read_authenticated" ON public.plan_versions
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.plan_versions FROM anon;
REVOKE SELECT (stripe_price_id) ON public.plan_versions FROM anon, authenticated;
GRANT SELECT (
  id, plan_id, version_number, price, currency, interval, trial_days,
  features, status, effective_from, created_at,
  urgent_service_included, urgent_service_fee
) ON public.plan_versions TO authenticated;
GRANT ALL ON public.plan_versions TO service_role;

CREATE OR REPLACE VIEW public.plan_versions_public AS
SELECT id, plan_id, version_number, price, currency, interval, trial_days,
       features, status, effective_from, urgent_service_included, urgent_service_fee
FROM public.plan_versions
WHERE status = 'active';

GRANT SELECT ON public.plan_versions_public TO anon, authenticated;