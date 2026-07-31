-- 1) Availability of one staff member on one date (schedule + personal exception)
CREATE OR REPLACE FUNCTION public.staff_day_availability(_staff_id uuid, _date date)
RETURNS TABLE(is_working boolean, start_time time, end_time time, max_concurrent int, source text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow int := EXTRACT(DOW FROM _date)::int;
  v_sch record;
  v_exc record;
BEGIN
  SELECT ss.* INTO v_sch
    FROM public.staff_schedules ss
   WHERE ss.staff_id = _staff_id
     AND ss.day_of_week = v_dow
     AND ss.valid_from <= _date
     AND (ss.valid_until IS NULL OR ss.valid_until >= _date)
   ORDER BY ss.valid_from DESC
   LIMIT 1;

  SELECT se.* INTO v_exc
    FROM public.staff_schedule_exceptions se
   WHERE se.staff_id = _staff_id AND se.exception_date = _date
   LIMIT 1;

  IF v_exc.id IS NOT NULL THEN
    RETURN QUERY SELECT
      v_exc.is_working,
      COALESCE(v_exc.start_time, v_sch.start_time),
      COALESCE(v_exc.end_time, v_sch.end_time),
      GREATEST(1, COALESCE(v_sch.max_concurrent, 1)),
      'exception'::text;
    RETURN;
  END IF;

  IF v_sch.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::time, NULL::time, 1, 'none'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_sch.is_working, v_sch.start_time, v_sch.end_time,
    GREATEST(1, COALESCE(v_sch.max_concurrent, 1)), 'schedule'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_day_availability(uuid, date) TO authenticated;

-- 2) Open (or close) a staff member's availability for a specific date
CREATE OR REPLACE FUNCTION public.set_staff_day_availability(
  _staff_id uuid,
  _date date,
  _is_working boolean DEFAULT true,
  _start time DEFAULT '09:00'::time,
  _end time DEFAULT '18:00'::time,
  _reason text DEFAULT NULL
)
RETURNS public.staff_schedule_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.staff_schedule_exceptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF auth.uid() <> _staff_id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _is_working AND (_end IS NULL OR _start IS NULL OR _end <= _start) THEN
    RAISE EXCEPTION 'Invalid availability window';
  END IF;

  DELETE FROM public.staff_schedule_exceptions
   WHERE staff_id = _staff_id AND exception_date = _date;

  INSERT INTO public.staff_schedule_exceptions
    (staff_id, exception_date, exception_type, is_working, start_time, end_time, reason)
  VALUES
    (_staff_id, _date,
     CASE WHEN _is_working THEN 'extra_day' ELSE 'day_off' END,
     _is_working,
     CASE WHEN _is_working THEN _start ELSE NULL END,
     CASE WHEN _is_working THEN _end ELSE NULL END,
     _reason)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_staff_day_availability(uuid, date, boolean, time, time, text) TO authenticated;

-- 3) Global guard: no bookings on closed days, outside shifts, or overlapping
CREATE OR REPLACE FUNCTION public.fn_validate_appointment_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow int;
  v_dur int;
  v_start time;
  v_end time;
  v_bh record;
  v_exc record;
  v_open time;
  v_close time;
  v_is_open boolean := false;
  v_parallel int := 3;
  v_avail record;
  v_conflicts int;
  v_busy int;
BEGIN
  IF NEW.status IN ('canceled', 'no_show', 'rescheduled', 'completed') THEN
    RETURN NEW;
  END IF;

  -- Only re-validate when the time/mechanic actually changed on updates.
  IF TG_OP = 'UPDATE'
     AND NEW.scheduled_date = OLD.scheduled_date
     AND NEW.scheduled_start_time = OLD.scheduled_start_time
     AND COALESCE(NEW.duration_minutes, -1) = COALESCE(OLD.duration_minutes, -1)
     AND COALESCE(NEW.assigned_mechanic_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(OLD.assigned_mechanic_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RETURN NEW;
  END IF;

  v_dow := EXTRACT(DOW FROM NEW.scheduled_date)::int;
  v_start := NEW.scheduled_start_time;
  v_dur := COALESCE(
    NEW.duration_minutes,
    (SELECT st.duration_minutes FROM public.service_types st WHERE st.id = NEW.service_type_id),
    60
  );
  v_end := COALESCE(NEW.scheduled_end_time, (v_start + (v_dur || ' minutes')::interval)::time);

  -- Workshop opening hours
  SELECT * INTO v_bh
    FROM public.business_hours bh
   WHERE bh.day_of_week = v_dow
     AND bh.valid_from <= NEW.scheduled_date
     AND (bh.valid_until IS NULL OR bh.valid_until >= NEW.scheduled_date)
   ORDER BY bh.valid_from DESC
   LIMIT 1;

  IF v_bh.id IS NOT NULL THEN
    v_is_open := v_bh.is_open;
    v_open := v_bh.open_time;
    v_close := v_bh.close_time;
    v_parallel := GREATEST(1, COALESCE(v_bh.max_parallel_services, 3));
  END IF;

  SELECT * INTO v_exc
    FROM public.business_hour_exceptions be
   WHERE be.exception_date = NEW.scheduled_date
   LIMIT 1;

  IF v_exc.id IS NOT NULL THEN
    v_is_open := v_exc.is_open;
    v_open := COALESCE(v_exc.open_time, v_open);
    v_close := COALESCE(v_exc.close_time, v_close);
    v_parallel := GREATEST(1, COALESCE(v_exc.max_parallel_services, v_parallel));
  END IF;

  IF v_bh.id IS NOT NULL OR v_exc.id IS NOT NULL THEN
    IF NOT v_is_open THEN
      RAISE EXCEPTION 'WORKSHOP_CLOSED: the workshop is closed on %', NEW.scheduled_date;
    END IF;
    IF v_open IS NOT NULL AND v_start < v_open THEN
      RAISE EXCEPTION 'OUTSIDE_HOURS: workshop opens at %', v_open;
    END IF;
    IF v_close IS NOT NULL AND v_end > v_close THEN
      RAISE EXCEPTION 'OUTSIDE_HOURS: workshop closes at %', v_close;
    END IF;
  END IF;

  IF NEW.assigned_mechanic_id IS NOT NULL THEN
    SELECT * INTO v_avail
      FROM public.staff_day_availability(NEW.assigned_mechanic_id, NEW.scheduled_date);

    IF v_avail IS NULL OR NOT v_avail.is_working THEN
      RAISE EXCEPTION 'MECHANIC_UNAVAILABLE: the mechanic is not available on %', NEW.scheduled_date;
    END IF;
    IF v_avail.start_time IS NOT NULL AND v_start < v_avail.start_time THEN
      RAISE EXCEPTION 'MECHANIC_OUTSIDE_SHIFT: shift starts at %', v_avail.start_time;
    END IF;
    IF v_avail.end_time IS NOT NULL AND v_end > v_avail.end_time THEN
      RAISE EXCEPTION 'MECHANIC_OUTSIDE_SHIFT: shift ends at %', v_avail.end_time;
    END IF;

    SELECT count(*) INTO v_conflicts
      FROM public.appointments a
     WHERE a.assigned_mechanic_id = NEW.assigned_mechanic_id
       AND a.scheduled_date = NEW.scheduled_date
       AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND a.status IN ('pending','confirmed','in_progress')
       AND GREATEST(a.scheduled_start_time, v_start)
           < LEAST(
               COALESCE(
                 a.scheduled_end_time,
                 (a.scheduled_start_time + (COALESCE(a.duration_minutes, 60) || ' minutes')::interval)::time
               ),
               v_end);

    IF v_conflicts > 0 THEN
      RAISE EXCEPTION 'SLOT_TAKEN: the mechanic already has a job overlapping % - %', v_start, v_end;
    END IF;
  END IF;

  SELECT count(*) INTO v_busy
    FROM public.appointments a
   WHERE a.scheduled_date = NEW.scheduled_date
     AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND a.status IN ('pending','confirmed','in_progress')
     AND GREATEST(a.scheduled_start_time, v_start)
         < LEAST(
             COALESCE(
               a.scheduled_end_time,
               (a.scheduled_start_time + (COALESCE(a.duration_minutes, 60) || ' minutes')::interval)::time
             ),
             v_end);

  IF v_busy >= v_parallel THEN
    RAISE EXCEPTION 'WORKSHOP_FULL: maximum of % parallel services reached at that time', v_parallel;
  END IF;

  NEW.scheduled_end_time := v_end;
  NEW.duration_minutes := v_dur;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_validate_appointment_slot ON public.appointments;
CREATE TRIGGER tg_validate_appointment_slot
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_appointment_slot();