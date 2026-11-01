-- Apply the same Philippine-time booking window as the player calendar.
-- Keep administrative reservations and management workflows unchanged.
CREATE OR REPLACE FUNCTION public.guard_player_booking_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  IF NEW.is_admin_block OR public.has_role(auth.uid(), 'admin')
     OR NEW.status NOT IN ('pending', 'paid') THEN
    RETURN NEW;
  END IF;
  IF NEW.booking_date IS NULL OR NEW.booking_date < v_today
     OR NEW.booking_date > v_today + 60 THEN
    RAISE EXCEPTION 'INVALID_BOOKING_DATE' USING ERRCODE = '22023';
  END IF;
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL
     OR NEW.start_time < time '07:00' OR NEW.end_time > time '23:00'
     OR NEW.end_time <= NEW.start_time
     OR EXTRACT(MINUTE FROM NEW.start_time) <> 0 OR EXTRACT(SECOND FROM NEW.start_time) <> 0
     OR EXTRACT(MINUTE FROM NEW.end_time) <> 0 OR EXTRACT(SECOND FROM NEW.end_time) <> 0 THEN
    RAISE EXCEPTION 'INVALID_BOOKING_TIME' USING ERRCODE = '22023';
  END IF;
  IF ((NEW.booking_date + NEW.start_time) AT TIME ZONE 'Asia/Manila') <= now() THEN
    RAISE EXCEPTION 'BOOKING_TIME_PASSED' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_player_booking_time ON public.bookings;
CREATE TRIGGER guard_player_booking_time
  BEFORE INSERT OR UPDATE OF court_id, booking_date, start_time, end_time ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_booking_time();

REVOKE ALL ON FUNCTION public.guard_player_booking_time() FROM PUBLIC, anon, authenticated;
