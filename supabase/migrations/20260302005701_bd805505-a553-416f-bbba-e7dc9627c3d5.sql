
-- Add explicit deny policies to user_roles for defense-in-depth
-- Even though RLS defaults to deny without permissive policies, explicit policies make intent clear

CREATE POLICY "Only system can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Only system can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Only system can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);
