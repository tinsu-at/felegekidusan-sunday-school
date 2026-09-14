-- Add and backfill Ethiopian age used by the admin dashboard and CSV export.
-- This migration is additive and safe to run when the column already exists.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS age_years integer;

WITH current_ec AS (
  SELECT CASE
    WHEN EXTRACT(MONTH FROM now()) > 9
      OR (EXTRACT(MONTH FROM now()) = 9 AND EXTRACT(DAY FROM now()) >= 11)
    THEN EXTRACT(YEAR FROM now())::int - 7
    ELSE EXTRACT(YEAR FROM now())::int - 8
  END AS year
)
UPDATE public.registrations r
SET age_years = GREATEST(
  0,
  (SELECT year FROM current_ec) - r.birth_year_ec
    - CASE WHEN r.birth_month_ec BETWEEN 7 AND 13 THEN 1 ELSE 0 END
)
WHERE r.birth_year_ec >= 1900;
