-- Prefer recoverable archive over destructive deletion.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE INDEX IF NOT EXISTS registrations_archived_at_idx
  ON public.registrations (archived_at);

CREATE INDEX IF NOT EXISTS registrations_age_group_idx
  ON public.registrations (age_group);

CREATE INDEX IF NOT EXISTS registrations_created_at_idx
  ON public.registrations (created_at DESC);
