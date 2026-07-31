CREATE OR REPLACE FUNCTION public.book_available_slot(
  p_user_id uuid,
  p_bike_id uuid,
  p_service_type_id uuid,
  p_subscription_id uuid,
  p_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_mechanic_id uuid,
  p_urgent boolean DEFAULT false,
  p_notes text DEFAULT NULL::text
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.appointments;
  v_row public.appointments;
  v_slot record;
  v_duration integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED: appointment owner does not match the signed-in user';
  END IF;

  IF p_mechanic_id IS NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: no mechanic was assigned to this slot';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_mechanic_id::text || ':' || p_date::text, 0)
  );

  SELECT a.* INTO v_existing
    FROM public.appointments a
   WHERE a.user_id = p_user_id
     AND a.service_type_id = p_service_type_id
     AND a.scheduled_date = p_date
     AND a.scheduled_start_time = p_start_time
     AND a.status IN ('pending','confirmed','in_progress')
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT s.* INTO v_slot
    FROM public.get_available_slots(p_date, p_service_type_id, p_mechanic_id) s
   WHERE s.start_time = to_char(p_start_time, 'HH24:MI')
     AND s.mechanic_id = p_mechanic_id
   LIMIT 1;

  IF v_slot.mechanic_id IS NULL THEN
    RAISE EXCEPTION 'SLOT_TAKEN: this slot is no longer available';
  END IF;

  SELECT duration_minutes INTO v_duration
    FROM public.service_types
   WHERE id = p_service_type_id
     AND is_active = true;

  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'SERVICE_UNAVAILABLE: service type is inactive or missing';
  END IF;

  INSERT INTO public.appointments (
    user_id,
    bike_id,
    service_type_id,
    assigned_mechanic_id,
    subscription_id,
    scheduled_date,
    scheduled_start_time,
    scheduled_end_time,
    duration_minutes,
    status,
    priority,
    priority_score,
    booked_via,
    notes
  ) VALUES (
    p_user_id,
    p_bike_id,
    p_service_type_id,
    p_mechanic_id,
    p_subscription_id,
    p_date,
    p_start_time,
    COALESCE(p_end_time, (p_start_time + (v_duration || ' minutes')::interval)::time),
    v_duration,
    'pending',
    CASE WHEN p_urgent THEN 'emergency' ELSE 'normal' END,
    CASE WHEN p_urgent THEN 100 ELSE 50 END,
    'portal',
    p_notes
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.book_available_slot(uuid, uuid, uuid, uuid, date, time without time zone, time without time zone, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_available_slot(uuid, uuid, uuid, uuid, date, time without time zone, time without time zone, uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_available_slot(uuid, uuid, uuid, uuid, date, time without time zone, time without time zone, uuid, boolean, text) TO service_role;