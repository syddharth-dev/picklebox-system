BEGIN;

-- Lock down the exposed schema and future functions created by this owner.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- Only the current, validated checkout RPC should create player reservations.
-- This legacy signature is granted in old migrations but its body is absent
-- from this repository; revoke it if it exists on the target database.
DO $$
BEGIN
  IF to_regprocedure('public.create_booking_reservation(uuid,date,time without time zone[],text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_booking_reservation(uuid,date,time without time zone[],text)
      FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

-- Internal slots contain reservation identifiers. Availability uses the narrow
-- SECURITY DEFINER projection below; clients do not need direct slot access.
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_slots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- Profiles are created by the auth trigger. Owners may edit only display data.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;
ALTER TABLE public.profiles ADD CONSTRAINT profile_name_size CHECK (octet_length(full_name) <= 400) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profile_phone_size CHECK (octet_length(phone) <= 80) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profile_avatar_size CHECK (octet_length(avatar_url) <= 2048) NOT VALID;

-- Do not let accidental/default table grants re-enable player payment writes.
DROP POLICY IF EXISTS "Users can create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;
REVOKE ALL ON public.bookings, public.payments, public.courts, public.open_play_sessions,
  public.open_play_registrations, public.faq_chat_rate_limits FROM PUBLIC, anon;
GRANT SELECT ON public.courts TO anon;
ALTER POLICY "Admins can manage courts" ON public.courts TO authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.bookings, public.payments, public.courts,
  public.open_play_sessions FROM authenticated;
ALTER TABLE public.courts ADD CONSTRAINT court_price_nonnegative
  CHECK (price_per_hour >= 0 AND price_per_hour <> 'NaN'::numeric) NOT VALID;
ALTER TABLE public.bookings ADD CONSTRAINT booking_amount_nonnegative
  CHECK (total_amount >= 0 AND total_amount <> 'NaN'::numeric) NOT VALID;
ALTER TABLE public.payments ADD CONSTRAINT payment_amount_nonnegative
  CHECK (amount >= 0 AND amount <> 'NaN'::numeric) NOT VALID;
-- Sessions are consumed through the authenticated, aggregated RPC. Avoid a
-- public SELECT policy invoking the authenticated-only role helper for anon.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.open_play_registrations FROM authenticated;
REVOKE ALL ON public.faq_chat_rate_limits FROM authenticated;

CREATE TABLE public.api_request_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL CHECK (bucket IN ('booking', 'open_play', 'notification')),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL CHECK (request_count BETWEEN 0 AND 31),
  PRIMARY KEY (user_id, bucket)
);
ALTER TABLE public.api_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_request_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.consume_user_api_quota(p_bucket text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user uuid := auth.uid(); v_allowed boolean; v_limit integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  v_limit := CASE p_bucket WHEN 'booking' THEN 30 WHEN 'open_play' THEN 20 WHEN 'notification' THEN 20 ELSE NULL END;
  IF v_limit IS NULL THEN RAISE EXCEPTION 'INVALID_QUOTA_BUCKET' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.api_request_limits AS q (user_id, bucket, window_started_at, request_count)
  VALUES (v_user, p_bucket, now(), 1)
  ON CONFLICT (user_id, bucket) DO UPDATE SET
    window_started_at = CASE WHEN q.window_started_at <= now() - interval '1 minute' THEN now() ELSE q.window_started_at END,
    request_count = CASE WHEN q.window_started_at <= now() - interval '1 minute' THEN 1 ELSE least(q.request_count + 1, v_limit + 1) END
  RETURNING request_count <= v_limit INTO v_allowed;
  RETURN v_allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_user_api_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_user_api_quota(text) TO authenticated;

CREATE FUNCTION public.guard_player_reservation_abuse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_hours numeric;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'bookings' THEN
    -- Serialize simultaneous requests from the same player before counting holds.
    PERFORM pg_advisory_xact_lock(hashtextextended('player-pending:' || auth.uid()::text, 0));
    SELECT COALESCE(sum(EXTRACT(epoch FROM (end_time - start_time)) / 3600), 0)
      INTO v_hours FROM public.bookings
      WHERE user_id = auth.uid() AND status = 'pending' AND NOT is_admin_block
        AND booking_date >= (now() AT TIME ZONE 'Asia/Manila')::date;
    IF v_hours + EXTRACT(epoch FROM (NEW.end_time - NEW.start_time)) / 3600 > 24 THEN
      RAISE EXCEPTION 'PENDING_BOOKING_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.consume_user_api_quota('booking') THEN RAISE EXCEPTION 'BOOKING_RATE_LIMIT'; END IF;
  ELSE
    IF NOT public.consume_user_api_quota('open_play') THEN RAISE EXCEPTION 'REGISTRATION_RATE_LIMIT'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER player_booking_abuse_guard BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_reservation_abuse();
CREATE TRIGGER player_registration_abuse_guard BEFORE INSERT ON public.open_play_registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_reservation_abuse();
REVOKE ALL ON FUNCTION public.guard_player_reservation_abuse() FROM PUBLIC, anon, authenticated;

-- Bound the paid AI budget over a day, not only short bursts. Saturating
-- counters also avoid integer overflow after repeated denied requests.
ALTER TABLE public.faq_chat_rate_limits
  ADD COLUMN day_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN day_request_count integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.consume_faq_chat_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user uuid := auth.uid(); v_allowed boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  INSERT INTO public.faq_chat_rate_limits AS q
    (user_id, window_started_at, request_count, day_started_at, day_request_count)
  VALUES (v_user, now(), 1, now(), 1)
  ON CONFLICT (user_id) DO UPDATE SET
    window_started_at = CASE WHEN q.window_started_at <= now() - interval '1 minute' THEN now() ELSE q.window_started_at END,
    request_count = CASE WHEN q.window_started_at <= now() - interval '1 minute' THEN 1 ELSE least(q.request_count, 10) + 1 END,
    day_started_at = CASE WHEN q.day_started_at <= now() - interval '24 hours' THEN now() ELSE q.day_started_at END,
    day_request_count = CASE WHEN q.day_started_at <= now() - interval '24 hours' THEN 1 ELSE least(q.day_request_count, 100) + 1 END
  RETURNING request_count <= 10 AND day_request_count <= 100 INTO v_allowed;
  RETURN v_allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_faq_chat_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_faq_chat_quota() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_reserved_slots(p_date date)
RETURNS TABLE(court_id uuid, start_time time, status public.booking_status, is_admin_block boolean, admin_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT bs.court_id, bs.start_time, b.status, b.is_admin_block,
    CASE WHEN public.has_role(auth.uid(), 'admin') THEN b.admin_note ELSE NULL END
  FROM public.booking_slots bs JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.booking_date = p_date AND bs.is_reserved AND b.status IN ('pending', 'paid')
  UNION ALL
  SELECT c.id, slot.at::time, 'paid'::public.booking_status, true, 'Open Play'::text
  FROM public.open_play_sessions s CROSS JOIN LATERAL unnest(s.court_ids) c(id)
  CROSS JOIN LATERAL generate_series(date_trunc('hour', s.session_date + s.start_time),
    s.session_date + s.end_time - interval '1 microsecond', interval '1 hour') slot(at)
  WHERE s.session_date = p_date AND s.status = 'scheduled';
$$;
REVOKE ALL ON FUNCTION public.get_reserved_slots(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reserved_slots(date) TO authenticated;

-- Pin temp-schema precedence for existing definer functions as well. Every
-- application table is schema-qualified, and API roles cannot create objects.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f.signature);
  END LOOP;
END;
$$;
COMMIT;
