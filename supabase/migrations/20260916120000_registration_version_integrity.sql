-- Registration version integrity helpers.
-- Additive only: no registration data is deleted or reset.

-- Older published snapshots were created before age_group was included in the
-- draft schema. Backfill that metadata from the corresponding draft question
-- where the field key still exists. New snapshots should already contain it;
-- this also makes historical exports safer when an old snapshot is inspected.
UPDATE public.registration_question_versions v
SET questions = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN q.age_group IS NOT NULL
        THEN item || jsonb_build_object('age_group', q.age_group)
        ELSE item
      END
      ORDER BY COALESCE((item->>'position')::integer, 0)
    )
    FROM jsonb_array_elements(v.questions) AS item
    LEFT JOIN public.registration_questions q
      ON q.field_key = item->>'field_key'
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof(v.questions) = 'array';

-- Keep session lookups efficient and make the intended one-active-session rule
-- explicit at the database level. The existing Telegram-user key remains the
-- source of truth; this index simply protects the lookup path.
CREATE INDEX IF NOT EXISTS registration_sessions_question_version_idx
  ON public.registration_sessions (question_version);

CREATE INDEX IF NOT EXISTS registrations_question_version_idx
  ON public.registrations (question_version);

CREATE INDEX IF NOT EXISTS registrations_age_group_idx
  ON public.registrations (age_group);
