-- Reassign appointments pointing to a mechanic account that no longer exists,
-- distributing them round-robin across current staff members.
WITH staff AS (
  SELECT ur.user_id, row_number() OVER (ORDER BY ur.user_id) - 1 AS idx,
         count(*) OVER () AS total
  FROM public.user_roles ur
  WHERE ur.role = 'staff'::app_role
),
orphans AS (
  SELECT a.id, row_number() OVER (ORDER BY a.scheduled_date, a.scheduled_start_time) - 1 AS rn
  FROM public.appointments a
  WHERE a.assigned_mechanic_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = a.assigned_mechanic_id AND ur.role = 'staff'::app_role
    )
)
UPDATE public.appointments a
SET assigned_mechanic_id = s.user_id
FROM orphans o
JOIN staff s ON s.idx = (o.rn % s.total)
WHERE a.id = o.id;