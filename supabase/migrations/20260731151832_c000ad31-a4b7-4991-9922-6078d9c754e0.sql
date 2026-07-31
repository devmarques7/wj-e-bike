-- 1. Rules -----------------------------------------------------------------
CREATE TABLE public.reward_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'service',
  base_points integer NOT NULL DEFAULT 0,
  points_per_eur numeric NOT NULL DEFAULT 0,
  min_condition_score integer,
  multiplier numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reward_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reward_rules TO authenticated;
GRANT ALL ON public.reward_rules TO service_role;

ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_rules_read" ON public.reward_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reward_rules_admin_write" ON public.reward_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_reward_rules_updated_at
  BEFORE UPDATE ON public.reward_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 2. Ledger -----------------------------------------------------------------
CREATE TABLE public.reward_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bike_id uuid REFERENCES public.customer_bikes(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  rule_code text,
  source_type text NOT NULL DEFAULT 'appointment',
  source_id uuid,
  points integer NOT NULL DEFAULT 0,
  base_points integer NOT NULL DEFAULT 0,
  multiplier numeric NOT NULL DEFAULT 1,
  condition_score integer,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reward_points_ledger_unique_source
  ON public.reward_points_ledger (source_type, source_id, rule_code)
  WHERE source_id IS NOT NULL;

CREATE INDEX reward_points_ledger_user_idx ON public.reward_points_ledger (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.reward_points_ledger TO authenticated;
GRANT ALL ON public.reward_points_ledger TO service_role;

ALTER TABLE public.reward_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_ledger_select_own_or_staff" ON public.reward_points_ledger
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "reward_ledger_insert_staff" ON public.reward_points_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. Default rules ----------------------------------------------------------
INSERT INTO public.reward_rules (code, label, description, kind, base_points, points_per_eur, min_condition_score)
VALUES
  ('service_completed', 'Completed revision', 'Base points from the service type performed on the bike.', 'service', 0, 0, NULL),
  ('service_fallback', 'Revision fallback', 'Points awarded when the service type has no configured reward.', 'service', 50, 0, NULL),
  ('condition_excellent', 'Excellent final condition', 'Bonus when the final validation scores 90% or more.', 'assessment', 50, 0, 90),
  ('condition_very_good', 'Very good final condition', 'Bonus when the final validation scores 75% or more.', 'assessment', 25, 0, 75),
  ('extras_purchase', 'Extra items & services', 'Points for extra parts/services charged on the appointment.', 'purchase', 0, 1, NULL)
ON CONFLICT (code) DO NOTHING;

-- 4. Award function ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_award_appointment_points(
  p_appointment_id uuid,
  p_condition_score integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_appt public.appointments;
  v_service_points integer := 0;
  v_service_name text;
  v_multiplier numeric := 1;
  v_rule public.reward_rules;
  v_total integer := 0;
  v_pts integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
    OR v_appt.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(st.reward_points, 0), st.name
    INTO v_service_points, v_service_name
    FROM public.service_types st
   WHERE st.id = v_appt.service_type_id;

  SELECT COALESCE((pv.entitlements->>'reward_points_multiplier')::numeric, 1)
    INTO v_multiplier
    FROM public.subscriptions s
    JOIN public.plan_versions pv ON pv.id = s.plan_version_id
   WHERE s.user_id = v_appt.user_id
   ORDER BY s.created_at DESC
   LIMIT 1;

  v_multiplier := COALESCE(v_multiplier, 1);

  -- Service points
  IF COALESCE(v_service_points, 0) > 0 THEN
    SELECT * INTO v_rule FROM public.reward_rules WHERE code = 'service_completed' AND is_active;
  ELSE
    SELECT * INTO v_rule FROM public.reward_rules WHERE code = 'service_fallback' AND is_active;
    v_service_points := COALESCE(v_rule.base_points, 0);
  END IF;

  IF v_rule.id IS NOT NULL AND v_service_points > 0 THEN
    v_pts := ROUND(v_service_points * v_multiplier * COALESCE(v_rule.multiplier, 1));
    INSERT INTO public.reward_points_ledger
      (user_id, bike_id, appointment_id, rule_code, source_type, source_id,
       points, base_points, multiplier, condition_score, description, created_by, metadata)
    VALUES
      (v_appt.user_id, v_appt.bike_id, v_appt.id, v_rule.code, 'appointment', v_appt.id,
       v_pts, v_service_points, v_multiplier, p_condition_score,
       COALESCE(v_service_name, 'Service') || ' completed', auth.uid(),
       jsonb_build_object('service_type_id', v_appt.service_type_id))
    ON CONFLICT (source_type, source_id, rule_code) WHERE source_id IS NOT NULL DO NOTHING;
    IF FOUND THEN v_total := v_total + v_pts; END IF;
  END IF;

  -- Condition bonus (highest matching band)
  IF p_condition_score IS NOT NULL THEN
    SELECT * INTO v_rule
      FROM public.reward_rules
     WHERE kind = 'assessment' AND is_active
       AND min_condition_score IS NOT NULL
       AND p_condition_score >= min_condition_score
     ORDER BY min_condition_score DESC
     LIMIT 1;

    IF v_rule.id IS NOT NULL AND v_rule.base_points > 0 THEN
      v_pts := ROUND(v_rule.base_points * v_multiplier * COALESCE(v_rule.multiplier, 1));
      INSERT INTO public.reward_points_ledger
        (user_id, bike_id, appointment_id, rule_code, source_type, source_id,
         points, base_points, multiplier, condition_score, description, created_by)
      VALUES
        (v_appt.user_id, v_appt.bike_id, v_appt.id, v_rule.code, 'appointment', v_appt.id,
         v_pts, v_rule.base_points, v_multiplier, p_condition_score, v_rule.label, auth.uid())
      ON CONFLICT (source_type, source_id, rule_code) WHERE source_id IS NOT NULL DO NOTHING;
      IF FOUND THEN v_total := v_total + v_pts; END IF;
    END IF;
  END IF;

  -- Extra items / services purchased on this job
  IF COALESCE(v_appt.extra_charge_eur, 0) > 0 THEN
    SELECT * INTO v_rule FROM public.reward_rules WHERE code = 'extras_purchase' AND is_active;
    IF v_rule.id IS NOT NULL AND v_rule.points_per_eur > 0 THEN
      v_pts := ROUND(v_appt.extra_charge_eur * v_rule.points_per_eur * v_multiplier);
      IF v_pts > 0 THEN
        INSERT INTO public.reward_points_ledger
          (user_id, bike_id, appointment_id, rule_code, source_type, source_id,
           points, base_points, multiplier, condition_score, description, created_by, metadata)
        VALUES
          (v_appt.user_id, v_appt.bike_id, v_appt.id, v_rule.code, 'appointment', v_appt.id,
           v_pts, v_pts, v_multiplier, p_condition_score, v_rule.label, auth.uid(),
           jsonb_build_object('extra_charge_eur', v_appt.extra_charge_eur))
        ON CONFLICT (source_type, source_id, rule_code) WHERE source_id IS NOT NULL DO NOTHING;
        IF FOUND THEN v_total := v_total + v_pts; END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_total;
END;
$function$;