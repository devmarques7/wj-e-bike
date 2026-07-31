CREATE TABLE public.staff_shift_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.staff_shifts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shift_breaks_shift ON public.staff_shift_breaks(shift_id);
CREATE INDEX idx_shift_breaks_user ON public.staff_shift_breaks(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_shift_breaks TO authenticated;
GRANT ALL ON public.staff_shift_breaks TO service_role;

ALTER TABLE public.staff_shift_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own shift breaks" ON public.staff_shift_breaks
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own shift breaks" ON public.staff_shift_breaks
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own shift breaks" ON public.staff_shift_breaks
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all shift breaks" ON public.staff_shift_breaks
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_shift_breaks_updated_at
BEFORE UPDATE ON public.staff_shift_breaks
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.staff_shifts ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0;