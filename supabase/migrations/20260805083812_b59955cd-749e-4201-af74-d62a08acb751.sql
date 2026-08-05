ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS work_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS work_resumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS work_paused_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qc_state jsonb NOT NULL DEFAULT '{}'::jsonb;