ALTER TABLE public.customer_bikes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE TABLE IF NOT EXISTS public.bike_archive_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL REFERENCES public.customer_bikes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  user_id uuid,
  bike_model text,
  bike_serial text,
  subscription_id uuid,
  plan_name text,
  reason text,
  archived_by uuid,
  restored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bike_archive_records TO authenticated;
GRANT ALL ON public.bike_archive_records TO service_role;

ALTER TABLE public.bike_archive_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own archived bike records"
ON public.bike_archive_records FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Staff manage archived bike records"
ON public.bike_archive_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

CREATE INDEX IF NOT EXISTS idx_bike_archive_records_user ON public.bike_archive_records(user_id);
CREATE INDEX IF NOT EXISTS idx_bike_archive_records_bike ON public.bike_archive_records(bike_id);

CREATE OR REPLACE FUNCTION public.fn_cancel_bike_subscription(p_bike_id uuid, p_reason text DEFAULT NULL)
RETURNS public.bike_archive_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bike public.customer_bikes;
  v_cp public.customer_profiles;
  v_sub public.subscriptions;
  v_plan text;
  v_remaining int;
  v_row public.bike_archive_records;
  v_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  v_staff := public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role);

  SELECT * INTO v_bike FROM public.customer_bikes WHERE id = p_bike_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bike not found'; END IF;

  SELECT * INTO v_cp FROM public.customer_profiles WHERE id = v_bike.customer_id;
  IF NOT v_staff AND (v_cp.user_id IS NULL OR v_cp.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT s.* INTO v_sub FROM public.subscriptions s
   WHERE s.user_id = v_cp.user_id
   ORDER BY s.created_at DESC LIMIT 1;

  IF v_sub.id IS NOT NULL THEN
    SELECT p.name INTO v_plan
      FROM public.plan_versions pv JOIN public.plans p ON p.id = pv.plan_id
     WHERE pv.id = v_sub.plan_version_id;
  END IF;

  UPDATE public.customer_bikes
     SET is_active = false,
         archived_at = now(),
         archived_reason = p_reason,
         archived_by = auth.uid(),
         updated_at = now()
   WHERE id = p_bike_id;

  INSERT INTO public.bike_archive_records
    (bike_id, customer_id, user_id, bike_model, bike_serial, subscription_id, plan_name, reason, archived_by)
  VALUES
    (v_bike.id, v_bike.customer_id, v_cp.user_id, v_bike.model, v_bike.serial, v_sub.id, v_plan, p_reason, auth.uid())
  RETURNING * INTO v_row;

  SELECT count(*) INTO v_remaining
    FROM public.customer_bikes
   WHERE customer_id = v_bike.customer_id AND is_active = true;

  IF v_remaining = 0 AND v_sub.id IS NOT NULL AND v_sub.status <> 'canceled'::subscription_status_enum THEN
    UPDATE public.subscriptions
       SET status = 'canceled'::subscription_status_enum,
           canceled_at = now(),
           cancel_at_period_end = false,
           updated_at = now()
     WHERE id = v_sub.id;

    INSERT INTO public.subscription_events (subscription_id, event_type, metadata, created_by)
    VALUES (v_sub.id, 'canceled'::subscription_event_enum,
            jsonb_build_object('reason', p_reason, 'bike_id', p_bike_id, 'source', 'member_wallet'),
            auth.uid());
  END IF;

  RETURN v_row;
END $$;