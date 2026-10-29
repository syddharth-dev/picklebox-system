-- Keep registration transitions serialized on the session row. Court scheduling
-- has a separate shared lock because bookings and Open Play use different tables.
CREATE INDEX IF NOT EXISTS open_play_sessions_date_status_idx
  ON public.open_play_sessions (session_date, status);
CREATE INDEX IF NOT EXISTS open_play_waitlist_idx
  ON public.open_play_registrations (session_id, waitlist_position, registered_at)
  WHERE status = 'waitlisted';

ALTER TABLE public.open_play_sessions
  ADD CONSTRAINT open_play_price_nonnegative CHECK (price_php >= 0 AND price_php <> 'NaN'::numeric) NOT VALID,
  ADD CONSTRAINT open_play_cutoff_nonnegative CHECK (cancel_cutoff_hours >= 0) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_open_play_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status <> 'scheduled' THEN RETURN NEW; END IF;
  IF cardinality(NEW.court_ids) = 0 OR array_position(NEW.court_ids, NULL) IS NOT NULL
     OR cardinality(NEW.court_ids) <> (SELECT count(DISTINCT id) FROM unnest(NEW.court_ids) id) THEN
    RAISE EXCEPTION 'INVALID_SESSION_COURTS' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.courts WHERE id = ANY(NEW.court_ids) AND is_active)
     <> cardinality(NEW.court_ids) THEN
    RAISE EXCEPTION 'COURT_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF ((NEW.session_date + NEW.start_time) AT TIME ZONE 'Asia/Manila') <= now() THEN
      RAISE EXCEPTION 'SESSION_ALREADY_STARTED' USING ERRCODE = '22023';
    END IF;
  ELSIF ROW(NEW.session_date, NEW.start_time, NEW.end_time, NEW.court_ids, NEW.status)
        IS DISTINCT FROM ROW(OLD.session_date, OLD.start_time, OLD.end_time, OLD.court_ids, OLD.status) THEN
    IF ((NEW.session_date + NEW.start_time) AT TIME ZONE 'Asia/Manila') <= now() THEN
      RAISE EXCEPTION 'SESSION_ALREADY_STARTED' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.max_players < (SELECT count(*) FROM public.open_play_registrations
                        WHERE session_id = NEW.id AND status IN ('registered', 'checked_in')) THEN
    RAISE EXCEPTION 'CAPACITY_BELOW_REGISTRATIONS' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('picklebox-court-schedule', 0));
  IF EXISTS (SELECT 1 FROM public.open_play_sessions s
             WHERE s.id <> NEW.id AND s.status = 'scheduled' AND s.session_date = NEW.session_date
               AND s.court_ids && NEW.court_ids
               AND s.start_time < NEW.end_time AND s.end_time > NEW.start_time)
     OR EXISTS (SELECT 1 FROM public.bookings b
                WHERE b.court_id = ANY(NEW.court_ids) AND b.booking_date = NEW.session_date
                  AND b.status IN ('pending', 'paid', 'completed')
                  AND b.start_time < NEW.end_time AND b.end_time > NEW.start_time) THEN
    RAISE EXCEPTION 'COURT_TIME_CONFLICT' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER open_play_schedule_guard BEFORE INSERT OR UPDATE ON public.open_play_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_open_play_schedule();

CREATE OR REPLACE FUNCTION public.guard_booking_open_play_conflict()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('pending', 'paid', 'completed') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('picklebox-court-schedule', 0));
    IF EXISTS (SELECT 1 FROM public.open_play_sessions s
               WHERE s.status = 'scheduled' AND s.session_date = NEW.booking_date
                 AND NEW.court_id = ANY(s.court_ids)
                 AND s.start_time < NEW.end_time AND s.end_time > NEW.start_time) THEN
      RAISE EXCEPTION 'COURT_TIME_CONFLICT' USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_open_play_guard
  BEFORE INSERT OR UPDATE OF court_id, booking_date, start_time, end_time, status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_open_play_conflict();

CREATE OR REPLACE FUNCTION public.rebalance_open_play_waitlist(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_session public.open_play_sessions;
BEGIN
  SELECT * INTO v_session FROM public.open_play_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.status = 'scheduled'
     AND ((v_session.session_date + v_session.start_time) AT TIME ZONE 'Asia/Manila') > now() THEN
    UPDATE public.open_play_registrations SET status = 'registered', waitlist_position = NULL
    WHERE id IN (
      SELECT id FROM public.open_play_registrations
      WHERE session_id = p_session_id AND status = 'waitlisted'
      ORDER BY waitlist_position NULLS LAST, registered_at, id
      LIMIT greatest(v_session.max_players - (SELECT count(*) FROM public.open_play_registrations
        WHERE session_id = p_session_id AND status IN ('registered', 'checked_in')), 0)
    );
  END IF;
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY waitlist_position NULLS LAST, registered_at, id) AS position
    FROM public.open_play_registrations WHERE session_id = p_session_id AND status = 'waitlisted'
  )
  UPDATE public.open_play_registrations r SET waitlist_position = ranked.position::int
  FROM ranked WHERE r.id = ranked.id AND r.waitlist_position IS DISTINCT FROM ranked.position::int;
END;
$$;
REVOKE ALL ON FUNCTION public.rebalance_open_play_waitlist(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_for_open_play(p_session_id uuid, p_payment_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session public.open_play_sessions;
  v_status public.open_play_registration_status;
  v_position int;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_session FROM public.open_play_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  IF v_session.status <> 'scheduled' THEN RAISE EXCEPTION 'SESSION_NOT_OPEN'; END IF;
  IF ((v_session.session_date + v_session.start_time) AT TIME ZONE 'Asia/Manila') <= now() THEN
    RAISE EXCEPTION 'SESSION_ALREADY_STARTED';
  END IF;
  IF v_session.price_php > 0 AND COALESCE(btrim(p_payment_reference), '') = '' THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED';
  END IF;
  IF length(btrim(p_payment_reference)) > 128 THEN RAISE EXCEPTION 'INVALID_PAYMENT_REFERENCE'; END IF;
  IF EXISTS (SELECT 1 FROM public.open_play_registrations
             WHERE session_id = p_session_id AND user_id = v_user AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'ALREADY_REGISTERED';
  END IF;
  PERFORM public.rebalance_open_play_waitlist(p_session_id);
  IF (SELECT count(*) FROM public.open_play_registrations
      WHERE session_id = p_session_id AND status IN ('registered', 'checked_in')) < v_session.max_players THEN
    v_status := 'registered';
  ELSE
    v_status := 'waitlisted';
    SELECT count(*) + 1 INTO v_position FROM public.open_play_registrations
      WHERE session_id = p_session_id AND status = 'waitlisted';
  END IF;
  INSERT INTO public.open_play_registrations
    (session_id, user_id, status, waitlist_position, payment_reference, payment_status)
  VALUES (p_session_id, v_user, v_status, v_position, NULLIF(btrim(p_payment_reference), ''),
          CASE WHEN v_session.price_php = 0 THEN 'completed'::public.payment_status ELSE 'pending'::public.payment_status END)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('registration_id', v_id, 'status', v_status, 'waitlist_position', v_position);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_open_play_registration(p_registration_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reg public.open_play_registrations;
  v_session public.open_play_sessions;
  v_promoted uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_reg FROM public.open_play_registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REG_NOT_FOUND'; END IF;
  IF v_reg.user_id <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_session FROM public.open_play_sessions WHERE id = v_reg.session_id FOR UPDATE;
  SELECT * INTO v_reg FROM public.open_play_registrations WHERE id = p_registration_id FOR UPDATE;
  IF v_reg.status = 'cancelled' THEN RETURN jsonb_build_object('cancelled', true); END IF;
  IF NOT public.has_role(v_user, 'admin') THEN
    IF v_session.status <> 'scheduled' OR v_reg.status NOT IN ('registered', 'waitlisted') THEN
      RAISE EXCEPTION 'REGISTRATION_NOT_CANCELLABLE';
    END IF;
    IF now() >= ((v_session.session_date + v_session.start_time) AT TIME ZONE 'Asia/Manila')
                - make_interval(hours => v_session.cancel_cutoff_hours) THEN
      RAISE EXCEPTION 'CANCELLATION_CUTOFF_PASSED';
    END IF;
  END IF;
  SELECT user_id INTO v_promoted FROM public.open_play_registrations
    WHERE session_id = v_reg.session_id AND status = 'waitlisted' AND id <> p_registration_id
    ORDER BY waitlist_position NULLS LAST, registered_at, id LIMIT 1;
  UPDATE public.open_play_registrations SET status = 'cancelled', waitlist_position = NULL WHERE id = p_registration_id;
  PERFORM public.rebalance_open_play_waitlist(v_reg.session_id);
  IF NOT EXISTS (SELECT 1 FROM public.open_play_registrations
                 WHERE session_id = v_reg.session_id AND user_id = v_promoted AND status = 'registered') THEN
    v_promoted := NULL;
  END IF;
  RETURN jsonb_build_object('cancelled', true, 'promoted_user_id', v_promoted);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_open_play_registration(
  p_registration_id uuid,
  p_status public.open_play_registration_status DEFAULT NULL,
  p_payment_status public.payment_status DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_reg public.open_play_registrations;
  v_session public.open_play_sessions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_reg FROM public.open_play_registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REG_NOT_FOUND'; END IF;
  SELECT * INTO v_session FROM public.open_play_sessions WHERE id = v_reg.session_id FOR UPDATE;
  SELECT * INTO v_reg FROM public.open_play_registrations WHERE id = p_registration_id FOR UPDATE;
  IF p_status IS NOT NULL AND p_status IS DISTINCT FROM v_reg.status THEN
    IF v_session.status <> 'scheduled' THEN RAISE EXCEPTION 'SESSION_NOT_OPEN'; END IF;
    IF NOT ((v_reg.status = 'registered' AND p_status IN ('checked_in', 'no_show', 'cancelled'))
         OR (v_reg.status = 'waitlisted' AND p_status IN ('no_show', 'cancelled'))
         OR (v_reg.status = 'checked_in' AND p_status = 'cancelled')) THEN
      RAISE EXCEPTION 'INVALID_REGISTRATION_TRANSITION';
    END IF;
  END IF;
  IF COALESCE(p_status, v_reg.status) = 'checked_in'
     AND COALESCE(p_payment_status, v_reg.payment_status) <> 'completed' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_APPROVED';
  END IF;
  IF p_status = 'checked_in' AND v_session.status <> 'scheduled' THEN RAISE EXCEPTION 'SESSION_NOT_OPEN'; END IF;
  UPDATE public.open_play_registrations
    SET status = COALESCE(p_status, status), payment_status = COALESCE(p_payment_status, payment_status),
        checked_in_at = CASE WHEN p_status = 'checked_in' THEN COALESCE(checked_in_at, now()) ELSE checked_in_at END,
        waitlist_position = CASE WHEN p_status IS NOT NULL AND p_status <> 'waitlisted' THEN NULL ELSE waitlist_position END
    WHERE id = p_registration_id;
  PERFORM public.rebalance_open_play_waitlist(v_reg.session_id);
END;
$$;
-- Admins use the same checked transitions as the UI. Direct updates bypass them.
REVOKE INSERT, UPDATE ON public.open_play_registrations FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_qr_token(p_kind text, p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_token text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_kind = 'booking' THEN
    SELECT qr_token INTO v_token FROM public.bookings WHERE id = p_id AND user_id = auth.uid() AND status = 'paid';
  ELSIF p_kind = 'open_play' THEN
    SELECT r.qr_token INTO v_token FROM public.open_play_registrations r
    JOIN public.open_play_sessions s ON s.id = r.session_id
    WHERE r.id = p_id AND r.user_id = auth.uid() AND r.status IN ('registered', 'checked_in')
      AND r.payment_status = 'completed' AND s.status = 'scheduled';
  ELSE RAISE EXCEPTION 'INVALID_QR_KIND';
  END IF;
  IF v_token IS NULL THEN RAISE EXCEPTION 'QR_NOT_AVAILABLE'; END IF;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.perform_checkin(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_b public.bookings;
  v_r public.open_play_registrations;
  v_session public.open_play_sessions;
  v_already boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  SELECT * INTO v_b FROM public.bookings WHERE qr_token = p_token FOR UPDATE;
  IF FOUND THEN
    IF v_b.status <> 'paid' THEN RAISE EXCEPTION 'PAYMENT_NOT_APPROVED'; END IF;
    v_already := v_b.checked_in_at IS NOT NULL;
    UPDATE public.bookings SET checked_in_at = COALESCE(checked_in_at, now()) WHERE id = v_b.id
      RETURNING * INTO v_b;
    RETURN jsonb_build_object('already', v_already, 'checked_in_at', v_b.checked_in_at, 'kind', 'booking');
  END IF;
  SELECT * INTO v_r FROM public.open_play_registrations WHERE qr_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'QR_NOT_FOUND'; END IF;
  SELECT * INTO v_session FROM public.open_play_sessions WHERE id = v_r.session_id FOR UPDATE;
  SELECT * INTO v_r FROM public.open_play_registrations WHERE qr_token = p_token FOR UPDATE;
  IF v_session.status <> 'scheduled' THEN RAISE EXCEPTION 'SESSION_NOT_OPEN'; END IF;
  IF v_r.payment_status <> 'completed' THEN RAISE EXCEPTION 'PAYMENT_NOT_APPROVED'; END IF;
  IF v_r.status NOT IN ('registered', 'checked_in') THEN RAISE EXCEPTION 'REGISTRATION_NOT_ACTIVE'; END IF;
  v_already := v_r.checked_in_at IS NOT NULL;
  PERFORM public.admin_update_open_play_registration(v_r.id, 'checked_in');
  SELECT * INTO v_r FROM public.open_play_registrations WHERE id = v_r.id;
  RETURN jsonb_build_object('already', v_already, 'checked_in_at', v_r.checked_in_at, 'kind', 'open_play');
END;
$$;

-- Prevent the read-only scanner from presenting a cancelled session as valid.
CREATE OR REPLACE FUNCTION public.lookup_checkin(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  SELECT jsonb_build_object('kind', 'booking', 'id', b.id, 'player_name', COALESCE(p.full_name, 'Player'),
    'title', COALESCE(c.name, 'Court'), 'reference_code', b.reference_code, 'event_date', b.booking_date,
    'start_time', b.start_time, 'end_time', b.end_time, 'payment_ok', b.status = 'paid',
    'status', b.status, 'checked_in_at', b.checked_in_at) INTO v_result
  FROM public.bookings b LEFT JOIN public.courts c ON c.id = b.court_id
  LEFT JOIN public.profiles p ON p.user_id = b.user_id WHERE b.qr_token = p_token;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF EXISTS (SELECT 1 FROM public.open_play_registrations r JOIN public.open_play_sessions s ON s.id = r.session_id
             WHERE r.qr_token = p_token AND s.status <> 'scheduled') THEN RAISE EXCEPTION 'SESSION_NOT_OPEN'; END IF;
  SELECT jsonb_build_object('kind', 'open_play', 'id', r.id, 'player_name', COALESCE(p.full_name, 'Player'),
    'title', COALESCE(s.title, 'Open Play'), 'reference_code', r.payment_reference, 'event_date', s.session_date,
    'start_time', s.start_time, 'end_time', s.end_time,
    'payment_ok', r.payment_status = 'completed' AND r.status IN ('registered', 'checked_in'),
    'status', r.status, 'checked_in_at', r.checked_in_at) INTO v_result
  FROM public.open_play_registrations r JOIN public.open_play_sessions s ON s.id = r.session_id
  LEFT JOIN public.profiles p ON p.user_id = r.user_id WHERE r.qr_token = p_token;
  IF v_result IS NULL THEN RAISE EXCEPTION 'QR_NOT_FOUND'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_reserved_slots(p_date date)
RETURNS TABLE(court_id uuid, start_time time, status public.booking_status, is_admin_block boolean, admin_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT bs.court_id, bs.start_time, b.status, b.is_admin_block, b.admin_note
  FROM public.booking_slots bs JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.booking_date = p_date AND bs.is_reserved AND b.status IN ('pending', 'paid')
  UNION ALL
  SELECT c.id, slot.at::time, 'paid'::public.booking_status, true, 'Open Play'::text
  FROM public.open_play_sessions s CROSS JOIN LATERAL unnest(s.court_ids) c(id)
  CROSS JOIN LATERAL generate_series(date_trunc('hour', s.session_date + s.start_time),
    s.session_date + s.end_time - interval '1 microsecond', interval '1 hour') slot(at)
  WHERE s.session_date = p_date AND s.status = 'scheduled';
$$;

CREATE OR REPLACE FUNCTION public.list_open_play_sessions(
  p_from date DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date,
  p_to date DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date + 60
)
RETURNS TABLE (
  id uuid, session_date date, start_time time, end_time time, court_ids uuid[], skill public.open_play_skill,
  max_players int, price_php numeric, cancel_cutoff_hours int, status text, title text, notes text,
  registered_count bigint, waitlist_count bigint, my_status public.open_play_registration_status, my_waitlist_position int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.id, s.session_date, s.start_time, s.end_time, s.court_ids, s.skill, s.max_players, s.price_php,
    s.cancel_cutoff_hours, s.status, s.title, s.notes,
    (SELECT count(*) FROM public.open_play_registrations r WHERE r.session_id = s.id AND r.status IN ('registered','checked_in')),
    (SELECT count(*) FROM public.open_play_registrations r WHERE r.session_id = s.id AND r.status = 'waitlisted'),
    (SELECT r.status FROM public.open_play_registrations r WHERE r.session_id = s.id AND r.user_id = auth.uid() AND r.status <> 'cancelled' LIMIT 1),
    (SELECT r.waitlist_position FROM public.open_play_registrations r WHERE r.session_id = s.id AND r.user_id = auth.uid() AND r.status = 'waitlisted' LIMIT 1)
  FROM public.open_play_sessions s WHERE s.session_date BETWEEN p_from AND p_to
    AND (s.status = 'scheduled' OR public.has_role(auth.uid(), 'admin')) ORDER BY s.session_date, s.start_time;
$$;

REVOKE ALL ON FUNCTION public.guard_open_play_schedule(), public.guard_booking_open_play_conflict() FROM PUBLIC, anon, authenticated;
