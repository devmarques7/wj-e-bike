CREATE TABLE public.pickup_places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  phone TEXT,
  is_headquarters BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pickup_places TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_places TO authenticated;
GRANT ALL ON public.pickup_places TO service_role;

ALTER TABLE public.pickup_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pickup places"
  ON public.pickup_places FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert pickup places"
  ON public.pickup_places FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pickup places"
  ON public.pickup_places FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pickup places"
  ON public.pickup_places FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pickup_places_updated_at
  BEFORE UPDATE ON public.pickup_places
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pickup_places (name, address, latitude, longitude, phone, is_headquarters, notes)
VALUES ('WJ Headquarters Amsterdam', 'Prinsengracht 263, 1016 GV Amsterdam, NL', 52.3752, 4.8840, '+31 20 123 4567', true, 'Main office and repair center');