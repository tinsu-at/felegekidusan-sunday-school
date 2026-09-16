-- Restore the intended eight registration questions if the live database missed
-- an earlier seed migration. This is idempotent and preserves existing labels,
-- validation text, options, and positions when a question already exists.
-- The four universal questions are core/required; the four parent questions are
-- optional/non-core as defined by the registration redesign.

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group)
VALUES
  ('full_name', 1,
   E'1\uFE0F\u20E3 ሙሉ ስም ከነአያት\n\nእባክዎ ሙሉ ስምዎን በአማርኛ ያስገቡ።',
   E'1\uFE0F\u20E3 Full name (with grandfather''s name)\n\nPlease enter the full name in three words.',
   'text', true, true, NULL, NULL, 3,
   '❌ እባክዎ ስሙን በአማርኛ በሦስት ቃላት ብቻ ያስገቡ።',
   '❌ Please enter the name in exactly three words.', '[]'::jsonb, true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = true, is_core = true, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group)
VALUES
  ('christian_name', 2,
   E'2\uFE0F\u20E3 የክርስትና ስም\n\nእባክዎ የክርስትና ስምዎን በአማርኛ ያስገቡ።',
   E'2\uFE0F\u20E3 Christian name\n\nPlease enter the Christian name.',
   'text', true, true, 1, 4, NULL,
   '❌ እባክዎ የክርስትና ስሙን በአማርኛ ብቻ ያስገቡ።',
   '❌ Please enter the Christian name using letters only.', '[]'::jsonb, true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = true, is_core = true, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   options, is_core, active, age_group)
VALUES
  ('gender', 3,
   E'3\uFE0F\u20E3 ጾታ\n\nእባክዎ ጾታዎን ይምረጡ።',
   E'3\uFE0F\u20E3 Gender\n\nPlease choose the gender.',
   'options', true, false,
   '[{"value":"ወንድ","label_am":"ወንድ","label_en":"Male"},{"value":"ሴት","label_am":"ሴት","label_en":"Female"}]'::jsonb,
   true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = true, is_core = true, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   options, is_core, active, age_group)
VALUES
  ('birth_date_ec', 4,
   E'4\uFE0F\u20E3 የትውልድ ቀን\n\nእባክዎ የትውልድ ቀኑን በኢትዮጵያ አቆጣጠር ያስገቡ።\n\nቅርጸት፦ ቀን/ወር/ዓመት\nለምሳሌ፦ 15/03/2012',
   E'4\uFE0F\u20E3 Date of birth\n\nPlease enter the date of birth in the Ethiopian calendar.\n\nFormat: DD/MM/YYYY\nExample: 15/03/2012',
   'ethiopian_date', true, false, '[]'::jsonb, true, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = true, is_core = true, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group)
VALUES
  ('mother_name', 5,
   E'5\uFE0F\u20E3 የእናት ስም ከየአያት\n\nእባክዎ የእናቱን ስም በአማርኛ ያስገቡ።',
   E'5\uFE0F\u20E3 Mother''s name\n\nPlease enter the mother''s full name.',
   'text', false, true, 1, 4, NULL,
   '❌ እባክዎ ስሙን በአማርኛ ያስገቡ።',
   '❌ Please enter the name using letters only.', '[]'::jsonb, false, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = false, is_core = false, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   options, is_core, active, age_group)
VALUES
  ('mother_phone', 6,
   E'6\uFE0F\u20E3 የእናት ስልክ\n\nእባክዎ የእናቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678',
   E'6\uFE0F\u20E3 Mother''s phone\n\nPlease enter the mother''s phone number.\n\nExample: 0912345678',
   'phone', false, false, '[]'::jsonb, false, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = false, is_core = false, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group)
VALUES
  ('father_name', 7,
   E'7\uFE0F\u20E3 የአባት ስም ከየአያት\n\nእባክዎ የአባቱን ስም በአማርኛ ያስገቡ።',
   E'7\uFE0F\u20E3 Father''s name\n\nPlease enter the father''s full name.',
   'text', false, true, 1, 4, NULL,
   '❌ እባክዎ ስሙን በአማርኛ ያስገቡ።',
   '❌ Please enter the name using letters only.', '[]'::jsonb, false, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = false, is_core = false, active = true, age_group = 'all';

INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   options, is_core, active, age_group)
VALUES
  ('father_phone', 8,
   E'8\uFE0F\u20E3 የአባት ስልክ\n\nእባክዎ የአባቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678',
   E'8\uFE0F\u20E3 Father''s phone\n\nPlease enter the father''s phone number.\n\nExample: 0912345678',
   'phone', false, false, '[]'::jsonb, false, true, 'all')
ON CONFLICT (field_key) DO UPDATE SET required = false, is_core = false, active = true, age_group = 'all';

-- Keep the intended eight-question order without changing any custom content.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY CASE field_key
      WHEN 'full_name' THEN 1
      WHEN 'christian_name' THEN 2
      WHEN 'gender' THEN 3
      WHEN 'birth_date_ec' THEN 4
      WHEN 'mother_name' THEN 5
      WHEN 'mother_phone' THEN 6
      WHEN 'father_name' THEN 7
      WHEN 'father_phone' THEN 8
      ELSE 9
    END, position, id
  ) AS new_position
  FROM public.registration_questions
  WHERE active = true
)
UPDATE public.registration_questions q
SET position = ordered.new_position
FROM ordered
WHERE q.id = ordered.id;
