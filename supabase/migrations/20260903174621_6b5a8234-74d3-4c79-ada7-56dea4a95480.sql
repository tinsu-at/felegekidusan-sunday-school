-- Reusable module/department platform foundation. Additive only.

CREATE TABLE public.platform_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_am text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  description_am text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '📦',
  category text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  student_visible boolean NOT NULL DEFAULT true,
  admin_visible boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_modules TO authenticated;
GRANT ALL ON public.platform_modules TO service_role;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view visible active modules"
  ON public.platform_modules FOR SELECT TO anon
  USING (active AND student_visible);
CREATE POLICY "Staff can view modules"
  ON public.platform_modules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can insert modules"
  ON public.platform_modules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update modules"
  ON public.platform_modules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete modules"
  ON public.platform_modules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_platform_modules_updated_at
  BEFORE UPDATE ON public.platform_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-role module permissions -------------------------------------------------
CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.platform_modules(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_submit boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_permissions TO authenticated;
GRANT ALL ON public.module_permissions TO service_role;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view module permissions"
  ON public.module_permissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can manage module permissions"
  ON public.module_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_module_permissions_updated_at
  BEFORE UPDATE ON public.module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Forms inside a module -------------------------------------------------------
CREATE TABLE public.module_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.platform_modules(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title_am text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  description_am text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  workflow_enabled boolean NOT NULL DEFAULT true,
  requires_student_id boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.module_forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_forms TO authenticated;
GRANT ALL ON public.module_forms TO service_role;
ALTER TABLE public.module_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published forms"
  ON public.module_forms FOR SELECT TO anon
  USING (
    published AND active AND EXISTS (
      SELECT 1 FROM public.platform_modules m
      WHERE m.id = module_forms.module_id AND m.active AND m.student_visible
    )
  );
CREATE POLICY "Staff can view forms"
  ON public.module_forms FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can manage forms"
  ON public.module_forms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_module_forms_updated_at
  BEFORE UPDATE ON public.module_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Form fields ----------------------------------------------------------------
CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.module_forms(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  field_type text NOT NULL DEFAULT 'text',
  label_am text NOT NULL DEFAULT '',
  label_en text NOT NULL DEFAULT '',
  help_am text NOT NULL DEFAULT '',
  help_en text NOT NULL DEFAULT '',
  placeholder text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT true,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_am text NOT NULL DEFAULT '',
  error_en text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, field_key)
);

GRANT SELECT ON public.form_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view fields of published forms"
  ON public.form_fields FOR SELECT TO anon
  USING (
    active AND EXISTS (
      SELECT 1 FROM public.module_forms f
      JOIN public.platform_modules m ON m.id = f.module_id
      WHERE f.id = form_fields.form_id
        AND f.published AND f.active AND m.active AND m.student_visible
    )
  );
CREATE POLICY "Staff can view fields"
  ON public.form_fields FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can manage fields"
  ON public.form_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_form_fields_updated_at
  BEFORE UPDATE ON public.form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submissions and workflow ----------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.submission_number_seq;

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_code text NOT NULL UNIQUE
    DEFAULT ('SUB-' || lpad(nextval('public.submission_number_seq')::text, 6, '0')),
  form_id uuid NOT NULL REFERENCES public.module_forms(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.platform_modules(id) ON DELETE CASCADE,
  registration_id text,
  student_name text NOT NULL DEFAULT '',
  telegram_user_id bigint,
  submitted_by uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid,
  assigned_label text NOT NULL DEFAULT '',
  review_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Staff can update submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete submissions"
  ON public.form_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX form_submissions_form_idx ON public.form_submissions (form_id, created_at DESC);
CREATE INDEX form_submissions_status_idx ON public.form_submissions (status);
CREATE INDEX form_submissions_registration_idx ON public.form_submissions (registration_id);

CREATE TABLE public.submission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  from_status text NOT NULL DEFAULT '',
  to_status text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  actor_id uuid,
  actor_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.submission_events TO authenticated;
GRANT ALL ON public.submission_events TO service_role;
ALTER TABLE public.submission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view submission history"
  ON public.submission_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX submission_events_submission_idx ON public.submission_events (submission_id, created_at DESC);

-- Seed: the existing Telegram registration system as a system module marker.
INSERT INTO public.platform_modules
  (slug, name_am, name_en, description_am, description_en, icon, category, display_order, active, student_visible, admin_visible, is_system)
VALUES
  ('registration', 'ምዝገባ', 'Registration',
   'በቴሌግራም ቦት የሚሠራው የተማሪዎች ምዝገባ ሥርዓት።',
   'The existing Telegram student registration system.',
   '📝', 'core', 1, true, true, true, true);