CREATE OR REPLACE FUNCTION public.resolve_booking_reservation(p_booking_id uuid, p_status booking_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_status NOT IN ('paid', 'cancelled') THEN RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.bookings SET status = p_status WHERE id = p_booking_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.booking_slots SET is_reserved = (p_status = 'paid') WHERE booking_id = p_booking_id;
  UPDATE public.payments
  SET status = (CASE WHEN p_status = 'paid' THEN 'completed' ELSE 'failed' END)::payment_status,
      paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END
  WHERE booking_id = p_booking_id AND status = 'pending';
END;
$function$;