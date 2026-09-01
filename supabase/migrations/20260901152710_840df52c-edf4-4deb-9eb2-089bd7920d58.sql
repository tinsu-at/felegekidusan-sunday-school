-- 1. Extra answers for custom questions (additive, nullable)
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS extra_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Draft question configuration
CREATE TABLE public.registration_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  label_am text NOT NULL DEFAULT '',
  label_en text NOT NULL DEFAULT '',
  input_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT true,
  amharic_only boolean NOT NULL DEFAULT true,
  min_words integer,
  max_words integer,
  exact_words integer,
  error_am text NOT NULL DEFAULT '',
  error_en text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_core boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.registration_questions TO authenticated;
GRANT ALL ON public.registration_questions TO service_role;
ALTER TABLE public.registration_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view questions"
ON public.registration_questions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_registration_questions_updated_at
BEFORE UPDATE ON public.registration_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Published snapshots
CREATE TABLE public.registration_question_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version integer NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX registration_question_versions_version_key
  ON public.registration_question_versions (version);

GRANT SELECT ON public.registration_question_versions TO authenticated;
GRANT ALL ON public.registration_question_versions TO service_role;
ALTER TABLE public.registration_question_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view published questions"
ON public.registration_question_versions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- 4. Seed the current 8 questions as the draft list
INSERT INTO public.registration_questions
  (field_key, position, label_am, label_en, input_type, required, amharic_only,
   min_words, max_words, exact_words, error_am, error_en, options, is_core, active)
VALUES
  ('full_name', 1,
   E'1\uFE0F\u20E3 ሙሉ ስም ከነአያት\n\nእባክዎ ሙሉ ስምዎን በአማርኛ ያስገቡ።',
   E'1\uFE0F\u20E3 Full name (with grandfather''s name)\n\nPlease enter the full name in three words.',
   'text', true, true, NULL, NULL, 3,
   '❌ እባክዎ ስሙን በአማርኛ በሦስት ቃላት ብቻ ያስገቡ።',
   '❌ Please enter the name in exactly three words.',
   '[]'::jsonb, true, true),
  ('christian_name', 2,
   E'2\uFE0F\u20E3 የክርስትና ስም\n\nእባክዎ የክርስትና ስምዎን በአማርኛ ያስገቡ።',
   E'2\uFE0F\u20E3 Christian name\n\nPlease enter the Christian name.',
   'text', true, true, 1, 4, NULL,
   '❌ እባክዎ የክርስትና ስሙን በአማርኛ ብቻ ያስገቡ።',
   '❌ Please enter the Christian name using letters only.',
   '[]'::jsonb, true, true),
  ('gender', 3,
   E'3\uFE0F\u20E3 ጾታ\n\nእባክዎ ጾታዎን ይምረጡ።',
   E'3\uFE0F\u20E3 Gender\n\nPlease choose the gender.',
   'options', true, false, NULL, NULL, NULL, '', '',
   '[{"value":"ወንድ","label_am":"ወንድ","label_en":"Male"},{"value":"ሴት","label_am":"ሴት","label_en":"Female"}]'::jsonb,
   true, true),
  ('birth_date_ec', 4,
   E'4\uFE0F\u20E3 የትውልድ ቀን\n\nእባክዎ የትውልድ ቀኑን በኢትዮጵያ አቆጣጠር ያስገቡ።\n\nቅርጸት፦ ቀን/ወር/ዓመት\nለምሳሌ፦ 15/03/2012',
   E'4\uFE0F\u20E3 Date of birth\n\nPlease enter the date of birth in the Ethiopian calendar.\n\nFormat: DD/MM/YYYY\nExample: 15/03/2012',
   'ethiopian_date', true, false, NULL, NULL, NULL, '', '',
   '[]'::jsonb, true, true),
  ('mother_name', 5,
   E'5\uFE0F\u20E3 የእናት ስም ከየአያት\n\nእባክዎ የእናቱን ስም በአማርኛ ያስገቡ።',
   E'5\uFE0F\u20E3 Mother''s name\n\nPlease enter the mother''s full name.',
   'text', true, true, 1, 4, NULL,
   '❌ እባክዎ ስሙን በአማርኛ ያስገቡ።',
   '❌ Please enter the name using letters only.',
   '[]'::jsonb, true, true),
  ('mother_phone', 6,
   E'6\uFE0F\u20E3 የእናት ስልክ\n\nእባክዎ የእናቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678',
   E'6\uFE0F\u20E3 Mother''s phone\n\nPlease enter the mother''s phone number.\n\nExample: 0912345678',
   'phone', true, false, NULL, NULL, NULL, '', '',
   '[]'::jsonb, true, true),
  ('father_name', 7,
   E'7\uFE0F\u20E3 የአባት ስም ከየአያት\n\nእባክዎ የአባቱን ስም በአማርኛ ያስገቡ።',
   E'7\uFE0F\u20E3 Father''s name\n\nPlease enter the father''s full name.',
   'text', true, true, 1, 4, NULL,
   '❌ እባክዎ ስሙን በአማርኛ ያስገቡ።',
   '❌ Please enter the name using letters only.',
   '[]'::jsonb, true, true),
  ('father_phone', 8,
   E'8\uFE0F\u20E3 የአባት ስልክ\n\nእባክዎ የአባቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678',
   E'8\uFE0F\u20E3 Father''s phone\n\nPlease enter the father''s phone number.\n\nExample: 0912345678',
   'phone', true, false, NULL, NULL, NULL, '', '',
   '[]'::jsonb, true, true);

-- 5. Publish version 1 from the seeded draft
INSERT INTO public.registration_question_versions (version, questions)
SELECT 1, COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.position), '[]'::jsonb)
FROM (
  SELECT field_key, position, label_am, label_en, input_type, required,
         amharic_only, min_words, max_words, exact_words, error_am, error_en,
         options, is_core, active
  FROM public.registration_questions
  WHERE active = true
) q;