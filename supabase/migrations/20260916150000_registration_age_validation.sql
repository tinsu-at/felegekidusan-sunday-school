-- Registration age validation: keep the stored Ethiopian age synchronized with
-- the Ethiopian birth date and prevent an age-group mismatch.
-- Additive only; existing rows are not rewritten.

CREATE OR REPLACE FUNCTION public.current_ethiopian_year()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  g_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  g_month integer := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
  g_day integer := EXTRACT(DAY FROM CURRENT_DATE)::integer;
BEGIN
  IF g_month > 9 OR (g_month = 9 AND g_day >= 11) THEN
    RETURN g_year - 7;
  END IF;
  RETURN g_year - 8;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_registration_age()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_age integer;
  eth_year integer;
BEGIN
  IF NEW.birth_year_ec IS NULL THEN
    NEW.age_years := NULL;
    RETURN NEW;
  END IF;

  eth_year := public.current_ethiopian_year();
  calculated_age := eth_year - NEW.birth_year_ec;

  IF NEW.birth_month_ec IS NOT NULL
     AND NEW.birth_month_ec BETWEEN 7 AND 13 THEN
    calculated_age := calculated_age - 1;
  END IF;

  IF calculated_age < 0 THEN
    RAISE EXCEPTION 'Birth date cannot be in the future';
  END IF;

  NEW.age_years := calculated_age;

  IF NEW.age_group IS NOT NULL THEN
    IF NEW.age_group = '7_13' AND calculated_age NOT BETWEEN 7 AND 13 THEN
      RAISE EXCEPTION 'Calculated Ethiopian age % does not match age group 7-13', calculated_age;
    ELSIF NEW.age_group = '14_17' AND calculated_age NOT BETWEEN 14 AND 17 THEN
      RAISE EXCEPTION 'Calculated Ethiopian age % does not match age group 14-17', calculated_age;
    ELSIF NEW.age_group = '18_plus' AND calculated_age < 18 THEN
      RAISE EXCEPTION 'Calculated Ethiopian age % does not match age group 18+', calculated_age;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_validate_age ON public.registrations;
CREATE TRIGGER registrations_validate_age
BEFORE INSERT OR UPDATE OF birth_year_ec, birth_month_ec, birth_day_ec, birth_date_ec, age_group
ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.validate_registration_age();

GRANT EXECUTE ON FUNCTION public.current_ethiopian_year() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_registration_age() TO authenticated, service_role;
