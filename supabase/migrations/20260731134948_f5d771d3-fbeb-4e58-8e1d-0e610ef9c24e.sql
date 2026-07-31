-- Full appointment change history is needed for realtime payload filters.
ALTER TABLE public.appointments REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.fn_notify_admins_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target RECORD;
  v_name TEXT;
  v_service TEXT;
  v_when TEXT;
BEGIN
  SELECT COALESCE(full_name, email) INTO v_name FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT name INTO v_service FROM public.service_types WHERE id = NEW.service_type_id;
  v_when := to_char(NEW.scheduled_date, 'DD Mon YYYY') || ' · ' || to_char(NEW.scheduled_start_time, 'HH24:MI');

  -- Staff + admins (deduped), plus the assigned mechanic if not already included.
  FOR v_target IN
    SELECT DISTINCT ur.user_id, bool_or(ur.role = 'admin'::app_role) AS is_admin
      FROM public.user_roles ur
     WHERE ur.role IN ('admin'::app_role, 'staff'::app_role)
        OR ur.user_id = NEW.assigned_mechanic_id
     GROUP BY ur.user_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_target.user_id,
      'appointment_created',
      CASE WHEN v_target.user_id = NEW.assigned_mechanic_id
           THEN 'New job assigned to you'
           ELSE 'New appointment scheduled' END,
      COALESCE(v_name, 'A customer') || ' · ' || COALESCE(v_service, 'Service') || ' · ' || v_when,
      CASE WHEN v_target.is_admin THEN '/dashboard/admin/manage' ELSE '/dashboard/staff/schedule' END,
      jsonb_build_object('appointment_id', NEW.id, 'scheduled_date', NEW.scheduled_date)
    );
  END LOOP;

  -- The rider gets their own confirmation.
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.user_id,
    'appointment_created',
    'Appointment booked',
    COALESCE(v_service, 'Service') || ' · ' || v_when,
    '/dashboard',
    jsonb_build_object('appointment_id', NEW.id, 'scheduled_date', NEW.scheduled_date)
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_notify_appointment_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target RECORD;
  v_service TEXT;
  v_when TEXT;
  v_title TEXT;
  v_msg TEXT;
  v_type TEXT;
  v_name TEXT;
BEGIN
  SELECT name INTO v_service FROM public.service_types WHERE id = NEW.service_type_id;
  SELECT COALESCE(full_name, email) INTO v_name FROM public.profiles WHERE user_id = NEW.user_id;
  v_when := to_char(NEW.scheduled_date, 'DD Mon YYYY') || ' · ' || to_char(NEW.scheduled_start_time, 'HH24:MI');

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_type := 'appointment_' || NEW.status::text;
    v_title := CASE NEW.status
      WHEN 'confirmed' THEN 'Appointment confirmed'
      WHEN 'in_progress' THEN 'Service started'
      WHEN 'completed' THEN 'Service completed'
      WHEN 'canceled' THEN 'Appointment canceled'
      WHEN 'no_show' THEN 'Appointment marked as no-show'
      WHEN 'rescheduled' THEN 'Appointment rescheduled'
      ELSE 'Appointment updated' END;
    v_msg := COALESCE(v_service, 'Service') || ' · ' || v_when;

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (NEW.user_id, v_type, v_title, v_msg, '/dashboard',
            jsonb_build_object('appointment_id', NEW.id));

    FOR v_target IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
       WHERE ur.role IN ('admin'::app_role, 'staff'::app_role)
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (v_target.user_id, v_type, v_title,
              COALESCE(v_name, 'A customer') || ' · ' || v_msg,
              '/dashboard/staff/schedule',
              jsonb_build_object('appointment_id', NEW.id));
    END LOOP;
  END IF;

  IF NEW.assigned_mechanic_id IS DISTINCT FROM OLD.assigned_mechanic_id
     AND NEW.assigned_mechanic_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (NEW.assigned_mechanic_id, 'appointment_assigned', 'New job assigned to you',
            COALESCE(v_name, 'A customer') || ' · ' || COALESCE(v_service, 'Service') || ' · ' || v_when,
            '/dashboard/staff/schedule',
            jsonb_build_object('appointment_id', NEW.id));
  END IF;

  IF (NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
      OR NEW.scheduled_start_time IS DISTINCT FROM OLD.scheduled_start_time)
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (NEW.user_id, 'appointment_rescheduled', 'New date for your service',
            COALESCE(v_service, 'Service') || ' · ' || v_when, '/dashboard',
            jsonb_build_object('appointment_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_appointment_updated ON public.appointments;
CREATE TRIGGER trg_notify_appointment_updated
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_appointment_updated();