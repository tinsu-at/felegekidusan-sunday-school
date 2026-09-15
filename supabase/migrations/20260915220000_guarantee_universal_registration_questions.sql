-- Ensure the four universal questions always exist and are published.
-- Additive/safe: existing registrations and custom questions are preserved.

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group)
VALUES
  ('full_name', 1,
   '1️⃣ ሙሉ ስም ከነአያት\n\nእባክዎ ሙሉ ስምዎን በአማርኛ ያስገቡ።',
   '1️⃣ Full name (with grandfather''s name)\n\nPlease enter the full name in three words.',
   'text', true, true, NULL, NULL, 3,
   '❌ እባክዎ ስሙን በአማርኛ በሦስት ቃላት ብቻ ያስገቡ።',
   '❌ Please enter the name in exactly three words.', '[]'::jsonb, true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET
  required = true, is_core = true, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group)
VALUES
  ('christian_name', 2,
   '2️⃣ የክርስትና ስም\n\nእባክዎ የክርስትና ስምዎን በአማርኛ ያስገቡ።',
   '2️⃣ Christian name\n\nPlease enter the Christian name.',
   'text', true, true, 1, 4, NULL,
   '❌ እባክዎ የክርስትና ስሙን በአማርኛ ብቻ ያስገቡ።',
   '❌ Please enter the Christian name using letters only.', '[]'::jsonb, true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET
  required = true, is_core = true, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   options, is_core, active, age_group)
VALUES
  ('gender', 3,
   '3️⃣ ጾታ\n\nእባክዎ ጾታዎን ይምረጡ።',
   '3️⃣ Gender\n\nPlease choose the gender.',
   'options', true, false,
   '[{"value":"ወንድ","label_am":"ወንድ","label_en":"Male"},{"value":"ሴት","label_am":"ሴት","label_en":"Female"}]'::jsonb,
   true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET
  required = true, is_core = true, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   options, is_core, active, age_group)
VALUES
  ('birth_date_ec', 4,
   '4️⃣ የትውልድ ቀን\n\nእባክዎ የትውልድ ቀኑን በኢትዮጵያ አቆጣጠር ያስገቡ።\n\nቅርጸት፦ ቀን/ወር/ዓመት\nለምሳሌ፦ 15/03/2012',
   '4️⃣ Date of birth\n\nPlease enter the date of birth in the Ethiopian calendar.\n\nFormat: DD/MM/YYYY\nExample: 15/03/2012',
   'ethiopian_date', true, false, '[]'::jsonb, true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET
  required = true, is_core = true, active = true, age_group = 'all';

-- Keep the universal questions first while preserving the relative order of all others.
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY CASE field_key
             WHEN 'full_name' THEN 1
             WHEN 'christian_name' THEN 2
             WHEN 'gender' THEN 3
             WHEN 'birth_date_ec' THEN 4
             ELSE 5
           END, position, id
         ) AS new_position
  FROM public.registration_questions
  WHERE active = true
)
UPDATE public.registration_questions q
SET position = ordered.new_position
FROM ordered
WHERE q.id = ordered.id;

-- Publish a new immutable snapshot so Telegram immediately has the universal questions.
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
