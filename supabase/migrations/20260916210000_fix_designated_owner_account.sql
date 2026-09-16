-- Keep exactly one designated owner account.
-- The old address must no longer receive owner access, while the designated
-- owner account is guaranteed to have both owner and admin roles.

DELETE FROM public.user_roles
WHERE role = 'owner'
  AND user_id IN (
    SELECT id
    FROM auth.users
    WHERE lower(trim(email)) = 'sinsaetsegaye85@gmail.com'
  );

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role
FROM auth.users
WHERE lower(trim(email)) = 'tinsaetsegaye85@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(trim(email)) = 'tinsaetsegaye85@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
