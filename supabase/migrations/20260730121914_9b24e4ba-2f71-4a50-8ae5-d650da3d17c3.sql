CREATE TABLE IF NOT EXISTS public.epass_card_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bike_id uuid REFERENCES public.customer_bikes(id) ON DELETE SET NULL,
  bike_serial text,
  bike_model text,
  card_number text NOT NULL,
  tier text NOT NULL DEFAULT 'light',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS epass_card_requests_card_number_key ON public.epass_card_requests(card_number);
CREATE INDEX IF NOT EXISTS epass_card_requests_user_idx ON public.epass_card_requests(user_id);

GRANT SELECT, INSERT, UPDATE ON public.epass_card_requests TO authenticated;
GRANT ALL ON public.epass_card_requests TO service_role;

ALTER TABLE public.epass_card_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own card requests" ON public.epass_card_requests
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Users create own card requests" ON public.epass_card_requests
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins update card requests" ON public.epass_card_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_epass_card_requests_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS epass_card_requests_updated_at ON public.epass_card_requests;
CREATE TRIGGER epass_card_requests_updated_at BEFORE UPDATE ON public.epass_card_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_epass_card_requests_updated_at();

CREATE OR REPLACE FUNCTION public.tg_epass_card_requests_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT ur.user_id, 'epass_card_request', 'New E-Pass card request',
           'A member requested a new digital card for bike ' || COALESCE(NEW.bike_serial, 'unknown'),
           '/dashboard/admin/members',
           jsonb_build_object('request_id', NEW.id, 'card_number', NEW.card_number)
    FROM public.user_roles ur WHERE ur.role = 'admin';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.user_id,
      'epass_card_' || NEW.status,
      CASE WHEN NEW.status = 'approved' THEN 'Your E-Pass card is active' ELSE 'E-Pass card request rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN 'Card ' || NEW.card_number || ' has been approved and added to your wallet.'
        ELSE COALESCE(NEW.review_notes, 'Your card request was rejected.') END,
      '/dashboard/e-pass',
      jsonb_build_object('request_id', NEW.id, 'card_number', NEW.card_number)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS epass_card_requests_notify ON public.epass_card_requests;
CREATE TRIGGER epass_card_requests_notify AFTER INSERT OR UPDATE ON public.epass_card_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_epass_card_requests_notify();