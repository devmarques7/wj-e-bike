CREATE TABLE public.bike_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bike_id uuid NOT NULL REFERENCES public.customer_bikes(id) ON DELETE CASCADE,
  customer_id uuid,
  origin text NOT NULL DEFAULT 'new',
  is_second_hand boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score integer NOT NULL DEFAULT 0,
  condition_label text NOT NULL DEFAULT 'unknown',
  notes text,
  assessed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_bike_assessments_bike ON public.bike_assessments (bike_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.bike_assessments TO authenticated;
GRANT ALL ON public.bike_assessments TO service_role;

ALTER TABLE public.bike_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage bike assessments"
ON public.bike_assessments FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Owners view their bike assessments"
ON public.bike_assessments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.customer_bikes b
  JOIN public.customer_profiles cp ON cp.id = b.customer_id
  WHERE b.id = bike_assessments.bike_id AND cp.user_id = auth.uid()
));

CREATE TRIGGER trg_bike_assessments_updated_at
BEFORE UPDATE ON public.bike_assessments
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();