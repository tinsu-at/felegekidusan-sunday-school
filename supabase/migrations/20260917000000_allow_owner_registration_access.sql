-- Owners are staff too, so registration RLS must match the application-level
-- owner/admin authorization used by the registration dashboard.

DROP POLICY IF EXISTS "Admins can view registrations" ON public.registrations;
CREATE POLICY "Admins can view registrations"
ON public.registrations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations;
CREATE POLICY "Admins can update registrations"
ON public.registrations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.registrations;
CREATE POLICY "Admins can delete registrations"
ON public.registrations FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
);
