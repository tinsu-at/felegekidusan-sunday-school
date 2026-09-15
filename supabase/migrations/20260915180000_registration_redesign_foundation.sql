-- Registration redesign foundation: age groups, immutable question version on each
-- registration/session, and an audit trail. All changes are additive.

ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS age_group text NOT NULL DEFAULT 'all';

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS age_group text,
  ADD COLUMN IF NOT EXISTS question_version integer;

ALTER TABLE public.registration_sessions
  ADD COLUMN IF NOT EXISTS age_group text,
  ADD COLUMN IF NOT EXISTS question_version integer;

CREATE TABLE IF NOT EXISTS public.registration_audit_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.registration_audit_history TO service_role;
GRANT SELECT ON public.registration_audit_history TO authenticated;
ALTER TABLE public.registration_audit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view registration audit history"
ON public.registration_audit_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Normalize the draft configuration for the new model. The four universal
-- questions remain required; the legacy parent fields become optional so the
-- owner can later assign them to the appropriate age groups manually.
UPDATE public.registration_questions
SET age_group = 'all'
WHERE field_key IN ('full_name', 'christian_name', 'gender', 'birth_date_ec');

UPDATE public.registration_questions
SET age_group = 'all', required = false
WHERE field_key IN ('mother_name', 'mother_phone', 'father_name', 'father_phone');

ALTER TABLE public.registration_questions
  DROP CONSTRAINT IF EXISTS registration_questions_age_group_check;
ALTER TABLE public.registration_questions
  ADD CONSTRAINT registration_questions_age_group_check
  CHECK (age_group IN ('all', '7_13', '14_17', '18_plus'));

ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_age_group_check;
ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_age_group_check
  CHECK (age_group IS NULL OR age_group IN ('7_13', '14_17', '18_plus'));

-- Keep existing historical published versions intact. New registrations use
-- the latest published version after the owner publishes the redesigned draft.
