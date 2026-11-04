BEGIN;

-- The public Courts page needs availability before sign-in. The hardened RPC
-- returns only occupied hours and masks private admin notes for non-admins.
-- Keep direct booking, payment and booking_slots access restricted.
GRANT EXECUTE ON FUNCTION public.get_reserved_slots(date) TO anon;

COMMIT;
