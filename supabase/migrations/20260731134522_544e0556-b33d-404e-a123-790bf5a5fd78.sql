CREATE OR REPLACE FUNCTION public.get_available_slots(_date date, _service_type_id uuid, _mechanic_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(start_time text, end_time text, mechanic_id uuid, mechanic_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dow int := EXTRACT(DOW FROM _date)::int;
  v_open time;
  v_close time;
  v_buffer int := 15;
  v_is_open boolean := false;
  v_duration int;
  v_step int := 30;
  v_parallel int := 3;
  v_exc record;
  v_bh record;
  v_now timestamptz := now();
  v_today date := (v_now AT TIME ZONE 'Europe/Amsterdam')::date;
  v_min_time time := '00:00'::time;
  v_lead int := 60; -- minimum minutes of lead time for same-day bookings
BEGIN
  IF _date < v_today THEN RETURN; END IF;

  SELECT duration_minutes INTO v_duration
  FROM service_types WHERE id = _service_type_id AND is_active = true;
  IF v_duration IS NULL THEN RETURN; END IF;

  IF _date = v_today THEN
    v_min_time := (((v_now AT TIME ZONE 'Europe/Amsterdam') + (v_lead || ' minutes')::interval))::time;
  END IF;

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
    v_parallel := GREATEST(1, COALESCE(v_bh.max_parallel_services, 3));
  END IF;

  SELECT * INTO v_exc
  FROM business_hour_exceptions
  WHERE exception_date = _date
  LIMIT 1;

  IF FOUND THEN
    v_is_open := v_exc.is_open;
    v_open := COALESCE(v_exc.open_time, v_open);
    v_close := COALESCE(v_exc.close_time, v_close);
    v_parallel := GREATEST(1, COALESCE(v_exc.max_parallel_services, v_parallel));
  END IF;

  IF NOT v_is_open OR v_open IS NULL OR v_close IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH base_staff AS (
    SELECT DISTINCT ON (ss.staff_id)
      ss.staff_id, ss.start_time AS s_start, ss.end_time AS s_end,
      GREATEST(1, COALESCE(ss.max_concurrent, 1)) AS s_max
    FROM staff_schedules ss
    WHERE ss.day_of_week = v_dow
      AND ss.is_working = true
      AND ss.valid_from <= _date
      AND (ss.valid_until IS NULL OR ss.valid_until >= _date)
      AND (_mechanic_id IS NULL OR ss.staff_id = _mechanic_id)
    ORDER BY ss.staff_id, ss.valid_from DESC
  ),
  exc AS (
    SELECT se.staff_id, se.is_working, se.start_time, se.end_time
    FROM staff_schedule_exceptions se
    WHERE se.exception_date = _date
  ),
  staff AS (
    SELECT bs.staff_id,
           COALESCE(e.start_time, bs.s_start) AS s_start,
           COALESCE(e.end_time, bs.s_end) AS s_end,
           bs.s_max
    FROM base_staff bs
    LEFT JOIN exc e ON e.staff_id = bs.staff_id
    WHERE COALESCE(e.is_working, true) = true
  ),
  busy AS (
    SELECT a.assigned_mechanic_id, a.scheduled_start_time AS b_start,
           (a.scheduled_start_time + (COALESCE(a.duration_minutes, v_duration) || ' minutes')::interval)::time AS b_end
    FROM appointments a
    WHERE a.scheduled_date = _date
      AND a.status IN ('pending','confirmed','in_progress')
  ),
  load AS (
    SELECT st.staff_id,
           (SELECT count(*) FROM busy b WHERE b.assigned_mechanic_id = st.staff_id) AS jobs,
           row_number() OVER (ORDER BY st.staff_id) - 1 AS idx,
           (SELECT count(*) FROM staff) AS total
    FROM staff st
  ),
  -- Regular grid + the very last start that still fits before closing time.
  raw_slots AS (
    SELECT gs AS mins
    FROM generate_series(0,
      GREATEST(0, EXTRACT(EPOCH FROM (v_close - v_open))::int / 60 - v_duration),
      v_step) AS gs
    UNION
    SELECT GREATEST(0, EXTRACT(EPOCH FROM (v_close - v_open))::int / 60 - v_duration)
  ),
  slots AS (
    SELECT (v_open + (r.mins || ' minutes')::interval)::time AS t,
           (r.mins / v_step) AS slot_idx
    FROM raw_slots r
  ),
  free AS (
    SELECT s.t, s.slot_idx, st.staff_id, l.jobs, l.idx, l.total
    FROM slots s
    CROSS JOIN staff st
    JOIN load l ON l.staff_id = st.staff_id
    WHERE s.t >= v_min_time
      AND s.t >= st.s_start
      AND (s.t + (v_duration || ' minutes')::interval)::time <= st.s_end
      AND NOT EXISTS (
        SELECT 1 FROM busy b
        WHERE b.assigned_mechanic_id = st.staff_id
          AND GREATEST(b.b_start, s.t) < LEAST(b.b_end, (s.t + ((v_duration + v_buffer) || ' minutes')::interval)::time)
      )
      AND (
        SELECT count(*) FROM busy b2
        WHERE GREATEST(b2.b_start, s.t) < LEAST(b2.b_end, (s.t + (v_duration || ' minutes')::interval)::time)
      ) < v_parallel
  ),
  ranked AS (
    SELECT f.*,
      row_number() OVER (
        PARTITION BY f.t
        ORDER BY f.jobs ASC,
                 ((f.idx + f.slot_idx) % GREATEST(f.total, 1)) ASC,
                 f.staff_id
      ) AS rr
    FROM free f
  )
  SELECT
    to_char(r.t, 'HH24:MI') AS start_time,
    to_char((r.t + (v_duration || ' minutes')::interval)::time, 'HH24:MI') AS end_time,
    r.staff_id AS mechanic_id,
    COALESCE(p.full_name, 'Mechanic') AS mechanic_name
  FROM ranked r
  LEFT JOIN profiles p ON p.user_id = r.staff_id
  ORDER BY start_time, r.rr;
END;
$function$;