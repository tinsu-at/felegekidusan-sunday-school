-- Prevent the same student from being registered more than once.
-- Before this migration is applied, check for existing duplicates using:
--
-- SELECT
--   lower(regexp_replace(trim(coalesce(full_name, '')), '\\s+', ' ', 'g')) AS full_name_key,
--   lower(regexp_replace(trim(coalesce(christian_name, '')), '\\s+', ' ', 'g')) AS christian_name_key,
--   lower(trim(coalesce(gender, ''))) AS gender_key,
--   birth_date_ec,
--   lower(regexp_replace(trim(coalesce(mother_name, '')), '\\s+', ' ', 'g')) AS mother_name_key,
--   regexp_replace(trim(coalesce(mother_phone, '')), '[^0-9+]', '', 'g') AS mother_phone_key,
--   lower(regexp_replace(trim(coalesce(father_name, '')), '\\s+', ' ', 'g')) AS father_name_key,
--   regexp_replace(trim(coalesce(father_phone, '')), '[^0-9+]', '', 'g') AS father_phone_key,
--   COUNT(*) AS duplicate_count
-- FROM public.registrations
-- GROUP BY 1,2,3,4,5,6,7,8
-- HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS registrations_student_identity_unique_idx
ON public.registrations (
  lower(regexp_replace(trim(coalesce(full_name, '')), '\\s+', ' ', 'g')),
  lower(regexp_replace(trim(coalesce(christian_name, '')), '\\s+', ' ', 'g')),
  lower(trim(coalesce(gender, ''))),
  coalesce(birth_date_ec, ''),
  lower(regexp_replace(trim(coalesce(mother_name, '')), '\\s+', ' ', 'g')),
  regexp_replace(trim(coalesce(mother_phone, '')), '[^0-9+]', '', 'g'),
  lower(regexp_replace(trim(coalesce(father_name, '')), '\\s+', ' ', 'g')),
  regexp_replace(trim(coalesce(father_phone, '')), '[^0-9+]', '', 'g')
);
