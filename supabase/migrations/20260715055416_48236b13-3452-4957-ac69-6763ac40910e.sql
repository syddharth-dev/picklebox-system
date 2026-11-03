
-- Strengthen booking reference codes with cryptographically strong randomness
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reference_code := COALESCE(
    NEW.reference_code,
    'PB' || to_char(now(), 'YYMMDD') || upper(encode(gen_random_bytes(6), 'hex'))
  );
  NEW.expires_at := NULL;
  RETURN NEW;
END;
$$;

-- Lock down SECURITY DEFINER function execution: revoke from PUBLIC/anon,
-- grant EXECUTE only to authenticated for the RPCs the app calls.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_booking_reservation(uuid, date, time without time zone[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_reservation(uuid, date, time without time zone[], text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_booking_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking_reservation(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_booking_reservation(uuid, booking_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_booking_reservation(uuid, booking_status) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_bookings_atomic(date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bookings_atomic(date, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_reserved_slots(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reserved_slots(date) TO authenticated;

-- Trigger-only helpers should not be callable from the API at all
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_booking_reference() FROM PUBLIC, anon, authenticated;
