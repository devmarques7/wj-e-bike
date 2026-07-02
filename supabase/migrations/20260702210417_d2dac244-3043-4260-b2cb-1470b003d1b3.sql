
CREATE OR REPLACE FUNCTION public.get_available_slots(
  _date date,
  _service_type_id uuid,
  _mechanic_id uuid DEFAULT NULL
)
RETURNS TABLE (
  start_time text,
  end_time text,
  mechanic_id uuid,
  mechanic_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow int := EXTRACT(DOW FROM _date)::int;
  v_open time;
  v_close time;
  v_buffer int := 15;
  v_is_open boolean := false;
  v_duration int;
  v_step int := 30;
  v_exc record;
  v_bh record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT duration_minutes INTO v_duration
  FROM service_types WHERE id = _service_type_id AND is_active = true;
  IF v_duration IS NULL THEN RETURN; END IF;

  -- latest valid business_hours row for this dow with usable times
  SELECT * INTO v_bh
  FROM business_hours
  WHERE day_of_week = v_dow
    AND valid_from <= _date
    AND (valid_until IS NULL OR valid_until >= _date)
    AND is_open = true
    AND open_time IS NOT NULL
    AND close_time IS NOT NULL
  ORDER BY valid_from DESC
  LIMIT 1;

  IF v_bh.id IS NOT NULL THEN
    v_open := v_bh.open_time;
    v_close := v_bh.close_time;
    v_is_open := true;
    v_buffer := COALESCE(v_bh.buffer_minutes, 15);
  END IF;

  -- exceptions override
  SELECT * INTO v_exc
  FROM business_hour_exceptions
  WHERE exception_date = _date
  LIMIT 1;

  IF FOUND THEN
    v_is_open := v_exc.is_open;
    v_open := COALESCE(v_exc.open_time, v_open);
    v_close := COALESCE(v_exc.close_time, v_close);
  END IF;

  IF NOT v_is_open OR v_open IS NULL OR v_close IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH staff AS (
    SELECT DISTINCT ON (ss.staff_id)
      ss.staff_id, ss.start_time AS s_start, ss.end_time AS s_end
    FROM staff_schedules ss
    WHERE ss.day_of_week = v_dow
      AND ss.is_working = true
      AND ss.valid_from <= _date
      AND (ss.valid_until IS NULL OR ss.valid_until >= _date)
      AND (_mechanic_id IS NULL OR ss.staff_id = _mechanic_id)
    ORDER BY ss.staff_id, ss.valid_from DESC
  ),
  slots AS (
    SELECT (v_open + (gs || ' minutes')::interval)::time AS t
    FROM generate_series(0,
      GREATEST(0, EXTRACT(EPOCH FROM (v_close - v_open))::int / 60 - v_duration),
      v_step) AS gs
  ),
  busy AS (
    SELECT a.assigned_mechanic_id, a.scheduled_start_time AS b_start,
           (a.scheduled_start_time + (COALESCE(a.duration_minutes, v_duration) || ' minutes')::interval)::time AS b_end
    FROM appointments a
    WHERE a.scheduled_date = _date
      AND a.status IN ('pending','confirmed','in_progress')
      AND a.assigned_mechanic_id IS NOT NULL
  )
  SELECT
    to_char(s.t, 'HH24:MI') AS start_time,
    to_char((s.t + (v_duration || ' minutes')::interval)::time, 'HH24:MI') AS end_time,
    st.staff_id AS mechanic_id,
    COALESCE(p.full_name, 'Mecânico') AS mechanic_name
  FROM slots s
  CROSS JOIN staff st
  LEFT JOIN profiles p ON p.user_id = st.staff_id
  WHERE s.t >= st.s_start
    AND (s.t + (v_duration || ' minutes')::interval)::time <= st.s_end
    AND NOT EXISTS (
      SELECT 1 FROM busy b
      WHERE b.assigned_mechanic_id = st.staff_id
        AND GREATEST(b.b_start, s.t) < LEAST(b.b_end, (s.t + ((v_duration + v_buffer) || ' minutes')::interval)::time)
    )
  ORDER BY start_time, mechanic_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(date, uuid, uuid) TO authenticated;
