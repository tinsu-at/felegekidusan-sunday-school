CREATE OR REPLACE FUNCTION public.reserve_registration_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'FKN-' || lpad((nextval('registration_number_seq'::regclass))::text, 6, '0');
$$;

REVOKE ALL ON FUNCTION public.reserve_registration_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_registration_id() FROM anon;
REVOKE ALL ON FUNCTION public.reserve_registration_id() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_registration_id() TO service_role;