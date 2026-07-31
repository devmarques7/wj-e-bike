ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS completed_by uuid;

UPDATE public.appointments a
SET completed_by = COALESCE(
  (SELECT p.created_by
     FROM public.appointment_qc_progress p
    WHERE p.appointment_id = a.id AND p.created_by IS NOT NULL
    ORDER BY p.completed_at DESC NULLS LAST, p.stage_position DESC
    LIMIT 1),
  a.assigned_mechanic_id
)
WHERE a.status = 'completed' AND a.completed_by IS NULL;

CREATE OR REPLACE FUNCTION public.get_appointment_staff(_appointment_ids uuid[])
RETURNS TABLE(
  appointment_id uuid,
  mechanic_id uuid,
  mechanic_name text,
  completed_by uuid,
  completed_by_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.assigned_mechanic_id,
    pm.full_name,
    a.completed_by,
    pc.full_name
  FROM public.appointments a
  LEFT JOIN public.profiles pm ON pm.user_id = a.assigned_mechanic_id
  LEFT JOIN public.profiles pc ON pc.user_id = a.completed_by
  WHERE a.id = ANY(_appointment_ids)
    AND auth.uid() IS NOT NULL
    AND (
      a.user_id = auth.uid()
      OR a.assigned_mechanic_id = auth.uid()
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_staff(uuid[]) TO authenticated;
