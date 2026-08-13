-- 1. Extend registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'ወንድ',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS birth_day_ec integer,
  ADD COLUMN IF NOT EXISTS birth_month_ec integer,
  ADD COLUMN IF NOT EXISTS birth_date_ec text;

ALTER TABLE public.registrations ALTER COLUMN gender DROP DEFAULT;

-- 2. FKN registration id format
ALTER TABLE public.registrations
  ALTER COLUMN registration_id
  SET DEFAULT ('FKN-' || lpad((nextval('registration_number_seq'::regclass))::text, 6, '0'));

-- 3. Admin roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Admin-only access to registrations
GRANT SELECT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

DROP POLICY IF EXISTS "Admins can view registrations" ON public.registrations;
CREATE POLICY "Admins can view registrations"
ON public.registrations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations;
CREATE POLICY "Admins can update registrations"
ON public.registrations FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.registrations;
CREATE POLICY "Admins can delete registrations"
ON public.registrations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));