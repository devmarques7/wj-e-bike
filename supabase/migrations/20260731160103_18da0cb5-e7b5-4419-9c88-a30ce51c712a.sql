-- 1. Per-bike subscription link
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS bike_id uuid REFERENCES public.customer_bikes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pending_plan_version_id uuid REFERENCES public.plan_versions(id),
  ADD COLUMN IF NOT EXISTS pending_since timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_bike_uidx
  ON public.subscriptions (bike_id)
  WHERE bike_id IS NOT NULL AND status IN ('trialing','active','past_due');

CREATE INDEX IF NOT EXISTS subscriptions_bike_idx ON public.subscriptions (bike_id);

-- 2. Ensure every active bike of a rider has its own subscription row,
--    inheriting the rider's current plan.
CREATE OR REPLACE FUNCTION public.fn_sync_bike_subscriptions(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base public.subscriptions;
  v_bike record;
  v_created integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF auth.uid() <> p_user_id
     AND NOT public.has_role(auth.uid(),'admin'::app_role)
     AND NOT public.has_role(auth.uid(),'staff'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT s.* INTO v_base
    FROM public.subscriptions s
   WHERE s.user_id = p_user_id
     AND s.status IN ('trialing','active','past_due')
   ORDER BY (s.bike_id IS NULL) DESC, s.created_at DESC
   LIMIT 1;

  IF v_base.id IS NULL THEN RETURN 0; END IF;

  FOR v_bike IN
    SELECT b.id
      FROM public.customer_bikes b
      JOIN public.customer_profiles cp ON cp.id = b.customer_id
     WHERE cp.user_id = p_user_id
       AND b.is_active = true
     ORDER BY b.created_at ASC
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.bike_id = v_bike.id
         AND s.status IN ('trialing','active','past_due')
    ) THEN
      CONTINUE;
    END IF;

    IF v_base.bike_id IS NULL THEN
      UPDATE public.subscriptions SET bike_id = v_bike.id, updated_at = now()
       WHERE id = v_base.id;
      v_base.bike_id := v_bike.id;
    ELSE
      INSERT INTO public.subscriptions
        (user_id, bike_id, plan_version_id, status, payment_method,
         started_at, current_period_start, current_period_end)
      VALUES
        (p_user_id, v_bike.id, v_base.plan_version_id, v_base.status, v_base.payment_method,
         now(), now(), v_base.current_period_end);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_sync_bike_subscriptions(uuid) TO authenticated;

-- 3. Request a plan change for one bike. Free plans apply instantly,
--    paid plans wait for the payment integration.
CREATE OR REPLACE FUNCTION public.fn_request_bike_plan_change(p_bike_id uuid, p_plan_version_id uuid)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_price numeric;
  v_sub public.subscriptions;
  v_row public.subscriptions;
  v_free boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT cp.user_id INTO v_owner
    FROM public.customer_bikes b
    JOIN public.customer_profiles cp ON cp.id = b.customer_id
   WHERE b.id = p_bike_id;

  IF v_owner IS NULL THEN RAISE EXCEPTION 'BIKE_NOT_FOUND'; END IF;
  IF auth.uid() <> v_owner
     AND NOT public.has_role(auth.uid(),'admin'::app_role)
     AND NOT public.has_role(auth.uid(),'staff'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT pv.price INTO v_price FROM public.plan_versions pv WHERE pv.id = p_plan_version_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'PLAN_NOT_FOUND'; END IF;
  v_free := COALESCE(v_price, 0) <= 0;

  SELECT s.* INTO v_sub
    FROM public.subscriptions s
   WHERE s.bike_id = p_bike_id
     AND s.status IN ('trialing','active','past_due')
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF v_sub.id IS NULL THEN
    INSERT INTO public.subscriptions
      (user_id, bike_id, plan_version_id, status, payment_method,
       started_at, current_period_start,
       pending_plan_version_id, pending_since)
    VALUES
      (v_owner, p_bike_id,
       CASE WHEN v_free THEN p_plan_version_id
            ELSE COALESCE((SELECT pv.id FROM public.plan_versions pv
                             JOIN public.plans p ON p.id = pv.plan_id
                            WHERE p.is_default AND pv.status = 'active'
                            ORDER BY pv.version_number DESC LIMIT 1), p_plan_version_id) END,
       'active', 'cash', now(), now(),
       CASE WHEN v_free THEN NULL ELSE p_plan_version_id END,
       CASE WHEN v_free THEN NULL ELSE now() END)
    RETURNING * INTO v_row;
  ELSIF v_free THEN
    UPDATE public.subscriptions
       SET plan_version_id = p_plan_version_id,
           pending_plan_version_id = NULL,
           pending_since = NULL,
           updated_at = now()
     WHERE id = v_sub.id
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.subscriptions
       SET pending_plan_version_id = p_plan_version_id,
           pending_since = now(),
           updated_at = now()
     WHERE id = v_sub.id
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.subscription_events
    (subscription_id, event_type, from_plan_version_id, to_plan_version_id, created_by, metadata)
  VALUES
    (v_row.id, 'created'::subscription_event_enum, v_sub.plan_version_id, p_plan_version_id, auth.uid(),
     jsonb_build_object('bike_id', p_bike_id, 'awaiting_payment', NOT v_free, 'source', 'e_pass'));

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_request_bike_plan_change(uuid, uuid) TO authenticated;

-- 4. Cancel a pending (unpaid) plan change
CREATE OR REPLACE FUNCTION public.fn_cancel_pending_bike_plan(p_bike_id uuid)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_row public.subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT cp.user_id INTO v_owner
    FROM public.customer_bikes b
    JOIN public.customer_profiles cp ON cp.id = b.customer_id
   WHERE b.id = p_bike_id;

  IF v_owner IS NULL THEN RAISE EXCEPTION 'BIKE_NOT_FOUND'; END IF;
  IF auth.uid() <> v_owner
     AND NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.subscriptions
     SET pending_plan_version_id = NULL, pending_since = NULL, updated_at = now()
   WHERE bike_id = p_bike_id
     AND status IN ('trialing','active','past_due')
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_cancel_pending_bike_plan(uuid) TO authenticated;