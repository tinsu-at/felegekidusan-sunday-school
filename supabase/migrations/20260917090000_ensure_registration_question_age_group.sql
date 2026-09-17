-- Ensure the live registration_questions schema has the age_group column.
-- Idempotent so it is safe to apply even when the earlier migration already ran.

ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS age_group text NOT NULL DEFAULT 'all';

ALTER TABLE public.registration_questions
  DROP CONSTRAINT IF EXISTS registration_questions_age_group_check;

ALTER TABLE public.registration_questions
  ADD CONSTRAINT registration_questions_age_group_check
  CHECK (age_group IN ('all', '7_13', '14_17', '18_plus'));

UPDATE public.registration_questions
SET age_group = 'all'
WHERE age_group IS NULL;
