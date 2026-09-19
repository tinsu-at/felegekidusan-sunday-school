-- Allow a registration question to target multiple age groups.
-- Keep the legacy age_group column for backward compatibility and historical snapshots.

ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS age_groups jsonb NOT NULL DEFAULT '["all"]'::jsonb;

UPDATE public.registration_questions
SET age_groups = CASE
  WHEN age_group = 'all' THEN '["all"]'::jsonb
  WHEN age_group IN ('7_13', '14_17', '18_plus') THEN jsonb_build_array(age_group)
  ELSE '["all"]'::jsonb
END
WHERE age_groups IS NULL
   OR jsonb_typeof(age_groups) <> 'array'
   OR jsonb_array_length(age_groups) = 0;

ALTER TABLE public.registration_questions
  DROP CONSTRAINT IF EXISTS registration_questions_age_groups_check;
ALTER TABLE public.registration_questions
  ADD CONSTRAINT registration_questions_age_groups_check
  CHECK (
    jsonb_typeof(age_groups) = 'array'
    AND jsonb_array_length(age_groups) BETWEEN 1 AND 4
    AND age_groups <@ '["all", "7_13", "14_17", "18_plus"]'::jsonb
  );

-- New snapshots include the multi-select field. Existing published versions are
-- left untouched so historical registrations remain reproducible.
WITH latest AS (
  SELECT COALESCE(MAX(version), 0) + 1 AS version
  FROM public.registration_question_versions
), snapshot AS (
  SELECT jsonb_agg(to_jsonb(q) ORDER BY q.position) AS questions
  FROM public.registration_questions q
  WHERE q.active = true
)
INSERT INTO public.registration_question_versions (version, questions)
SELECT latest.version, COALESCE(snapshot.questions, '[]'::jsonb)
FROM latest CROSS JOIN snapshot;
