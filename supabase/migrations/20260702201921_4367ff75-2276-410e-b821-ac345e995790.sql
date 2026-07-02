
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT SELECT ON public.plans TO anon;
GRANT ALL ON public.plans TO service_role;
REVOKE SELECT (stripe_product_id) ON public.plans FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_versions TO authenticated;
GRANT SELECT ON public.plan_versions TO anon;
GRANT ALL ON public.plan_versions TO service_role;
