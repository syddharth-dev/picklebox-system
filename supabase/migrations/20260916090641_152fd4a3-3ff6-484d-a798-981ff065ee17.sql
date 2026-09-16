ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_admin_block boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note text;

DROP FUNCTION IF EXISTS public.get_reserved_slots(date);

CREATE FUNCTION public.get_reserved_slots(p_date date)
RETURNS TABLE(court_id uuid, start_time time without time zone, status booking_status, is_admin_block boolean, admin_note text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT bs.court_id, bs.start_time, b.status, b.is_admin_block, b.admin_note
  FROM public.booking_slots bs
  JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.booking_date = p_date
    AND bs.is_reserved = true
    AND b.status IN ('pending', 'paid');
$function$;

REVOKE ALL ON FUNCTION public.get_reserved_slots(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reserved_slots(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_court_block(
  p_court_id uuid,
  p_booking_date date,
  p_slot_start_times time without time zone[],
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_slots TIME[];
  v_booking public.bookings;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_booking_date IS NULL OR p_booking_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'INVALID_BOOKING_DATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(slot_time ORDER BY slot_time) INTO v_slots
  FROM (SELECT DISTINCT unnest(p_slot_start_times) AS slot_time) s;

  IF v_slots IS NULL OR array_length(v_slots, 1) = 0 THEN
    RAISE EXCEPTION 'INVALID_BOOKING_SLOTS' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.courts WHERE id = p_court_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bookings (user_id, court_id, booking_date, start_time, end_time, total_amount, status, is_admin_block, admin_note, expires_at)
  VALUES (
    v_admin, p_court_id, p_booking_date,
    v_slots[1], v_slots[array_length(v_slots, 1)] + INTERVAL '1 hour',
    0, 'paid', true, NULLIF(btrim(COALESCE(p_note, '')), ''), NULL
  )
  RETURNING * INTO v_booking;

  BEGIN
    INSERT INTO public.booking_slots (booking_id, court_id, booking_date, start_time)
    SELECT v_booking.id, p_court_id, p_booking_date, slot_time FROM unnest(v_slots) AS slot_time;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'BOOKING_SLOT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object('booking_id', v_booking.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_court_block(uuid, date, time without time zone[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_court_block(uuid, date, time without time zone[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_release_court_block(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.bookings SET status = 'cancelled'
  WHERE id = p_booking_id AND is_admin_block = true AND status <> 'cancelled';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOCK_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.booking_slots SET is_reserved = false WHERE booking_id = p_booking_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_release_court_block(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_release_court_block(uuid) TO authenticated;