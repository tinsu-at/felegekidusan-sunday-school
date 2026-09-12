ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS age_years integer;

-- Backfill using a dynamically computed current Ethiopian year:
-- after Meskerem 1 (Sep 11) the EC year is Gregorian - 7, otherwise - 8.
WITH cur AS (
  SELECT CASE
    WHEN (EXTRACT(MONTH FROM now()) > 9)
      OR (EXTRACT(MONTH FROM now()) = 9 AND EXTRACT(DAY FROM now()) >= 11)
    THEN EXTRACT(YEAR FROM now())::int - 7
    ELSE EXTRACT(YEAR FROM now())::int - 8
  END AS ec_year
)
UPDATE public.registrations r
SET age_years = GREATEST(
  0,
  (SELECT ec_year FROM cur) - r.birth_year_ec
    - CASE WHEN r.birth_month_ec BETWEEN 7 AND 13 THEN 1 ELSE 0 END
)
WHERE r.birth_year_ec >= 1900;