GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.plans TO service_role;
GRANT ALL ON public.plan_versions TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
REVOKE ALL ON public.plans FROM anon;
REVOKE ALL ON public.plan_versions FROM anon;
REVOKE ALL ON public.subscriptions FROM anon;