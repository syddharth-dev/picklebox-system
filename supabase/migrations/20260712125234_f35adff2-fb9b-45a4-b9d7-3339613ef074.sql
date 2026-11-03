
CREATE OR REPLACE VIEW public.booking_slots_public
WITH (security_invoker = on) AS
SELECT bs.court_id, bs.booking_date, bs.start_time, bs.is_reserved, b.status
FROM public.booking_slots bs
JOIN public.bookings b ON b.id = bs.booking_id
WHERE bs.is_reserved = true AND b.status IN ('pending', 'paid');

-- booking_slots policy already allows authenticated SELECT; view uses invoker rights.
-- We need bookings SELECT for the join — add a policy so authenticated users can read
-- minimal status info via the view. Since security_invoker uses caller's perms and
-- bookings is RLS-restricted to owner, we instead switch the view to security definer.

DROP VIEW public.booking_slots_public;

CREATE OR REPLACE FUNCTION public.get_reserved_slots(p_date date)
RETURNS TABLE(court_id uuid, start_time time, status booking_status)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bs.court_id, bs.start_time, b.status
  FROM public.booking_slots bs
  JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.booking_date = p_date
    AND bs.is_reserved = true
    AND b.status IN ('pending', 'paid');
$$;

GRANT EXECUTE ON FUNCTION public.get_reserved_slots(date) TO authenticated, anon;
