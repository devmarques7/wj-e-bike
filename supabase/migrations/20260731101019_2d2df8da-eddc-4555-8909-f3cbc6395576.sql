CREATE OR REPLACE FUNCTION public.get_epass_bike(_identifier text)
RETURNS TABLE(
  id uuid,
  customer_id uuid,
  model text,
  serial text,
  color text,
  image_url text,
  km integer,
  purchased_at date,
  last_service_at date,
  next_service_at date,
  services_completed integer,
  owner_customer_id uuid,
  owner_user_id uuid,
  owner_name text,
  owner_email text,
  owner_phone text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id text := trim(coalesce(_identifier, ''));
  v_staff boolean;
  v_bike public.customer_bikes;
  v_cp public.customer_profiles;
  v_p public.profiles;
BEGIN
  IF auth.uid() IS NULL OR v_id = '' THEN RETURN; END IF;
  v_staff := public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role);

  IF v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_bike FROM public.customer_bikes b WHERE b.id = v_id::uuid LIMIT 1;
  ELSE
    SELECT * INTO v_bike FROM public.customer_bikes b WHERE lower(b.serial) = lower(v_id) LIMIT 1;
  END IF;

  IF v_bike.id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_cp FROM public.customer_profiles cp WHERE cp.id = v_bike.customer_id LIMIT 1;
  IF v_cp.user_id IS NOT NULL THEN
    SELECT * INTO v_p FROM public.profiles pr WHERE pr.user_id = v_cp.user_id LIMIT 1;
  END IF;

  RETURN QUERY SELECT
    v_bike.id, v_bike.customer_id, v_bike.model, v_bike.serial, v_bike.color, v_bike.image_url,
    v_bike.km, v_bike.purchased_at, v_bike.last_service_at, v_bike.next_service_at,
    v_bike.services_completed,
    v_cp.id,
    CASE WHEN v_staff OR v_cp.user_id = auth.uid() THEN v_cp.user_id ELSE NULL END,
    v_p.full_name,
    CASE WHEN v_staff OR v_cp.user_id = auth.uid() THEN v_p.email ELSE NULL END,
    CASE WHEN v_staff OR v_cp.user_id = auth.uid() THEN v_p.phone ELSE NULL END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_epass_bike(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_epass_bike(text) TO authenticated, service_role;