ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS bike_id uuid REFERENCES public.customer_bikes(id) ON DELETE SET NULL;
ALTER TABLE public.appointment_waitlist ADD COLUMN IF NOT EXISTS bike_id uuid REFERENCES public.customer_bikes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_bike_id ON public.appointments(bike_id);
CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_bike_id ON public.appointment_waitlist(bike_id);