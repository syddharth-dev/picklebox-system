-- Security hardening: keep all booking and payment state transitions on
-- server-side RPCs, derive charges from the court record, and limit exposure
-- of participant data.

-- Direct table writes let an authenticated caller choose booking totals,
-- status, and payment records. The application uses the RPCs below instead.
DROP POLICY IF EXISTS "Users can create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;

-- A caller may only ask whether *they* are an admin. This still supports all
-- RLS policies while preventing account-role enumeration through the API.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND auth.uid() = _user_id
     AND EXISTS (
       SELECT 1
       FROM public.user_roles
       WHERE user_id = _user_id AND role = _role
     );
$$;

-- Derive the booking amount from the server-owned court price; never use a
-- browser-supplied amount or status. The function also validates the input
-- shape, active court, date, and whole-hour time range before reserving slots.
CREATE OR REPLACE FUNCTION public.create_bookings_atomic(
  p_date date,
  p_reference text,
  p_items jsonb
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_booking_id uuid;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_court uuid;
  v_start time;
  v_end time;
  v_hourly_rate numeric(10,2);
  v_amount numeric(10,2);
  v_slot time;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_date IS NULL OR p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'INVALID_BOOKING_DATE' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 12 THEN
    RAISE EXCEPTION 'INVALID_BOOKING_ITEMS' USING ERRCODE = '22023';
  END IF;
  IF p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_REFERENCE' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_court := (v_item->>'court_id')::uuid;
      v_start := (v_item->>'start_time')::time;
      v_end := (v_item->>'end_time')::time;
    EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
      RAISE EXCEPTION 'INVALID_BOOKING_ITEM' USING ERRCODE = '22023';
    END;

    IF v_court IS NULL OR v_start IS NULL OR v_end IS NULL
       OR v_end <= v_start
       OR EXTRACT(MINUTE FROM v_start) <> 0
       OR EXTRACT(SECOND FROM v_start) <> 0
       OR EXTRACT(MINUTE FROM v_end) <> 0
       OR EXTRACT(SECOND FROM v_end) <> 0 THEN
      RAISE EXCEPTION 'INVALID_BOOKING_TIME' USING ERRCODE = '22023';
    END IF;

    SELECT price_per_hour INTO v_hourly_rate
    FROM public.courts
    WHERE id = v_court AND is_active = true
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'COURT_UNAVAILABLE' USING ERRCODE = '22023';
    END IF;

    v_amount := v_hourly_rate * (EXTRACT(EPOCH FROM (v_end - v_start)) / 3600);

    BEGIN
      INSERT INTO public.bookings
        (user_id, court_id, booking_date, start_time, end_time, total_amount, status, is_admin_block)
      VALUES
        (v_user, v_court, p_date, v_start, v_end, v_amount, 'pending', false)
      RETURNING id INTO v_booking_id;
    EXCEPTION WHEN unique_violation OR exclusion_violation THEN
      RAISE EXCEPTION 'SLOT_TAKEN:%:%', v_court, v_start USING ERRCODE = '23P01';
    END;

    v_slot := v_start;
    WHILE v_slot < v_end LOOP
      BEGIN
        INSERT INTO public.booking_slots (booking_id, court_id, booking_date, start_time, is_reserved)
        VALUES (v_booking_id, v_court, p_date, v_slot, true);
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'SLOT_TAKEN:%:%', v_court, v_slot USING ERRCODE = '23P01';
      END;
      v_slot := v_slot + INTERVAL '1 hour';
    END LOOP;

    INSERT INTO public.payments
      (booking_id, user_id, amount, payment_method, transaction_reference, status)
    VALUES
      (v_booking_id, v_user, v_amount, 'gcash', btrim(p_reference), 'pending');

    v_ids := array_append(v_ids, v_booking_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

-- Users may cancel only their own *pending* reservation. Paid bookings need an
-- administrator-led refund decision and cannot be silently altered by clients.
CREATE OR REPLACE FUNCTION public.cancel_booking_reservation(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id
    AND user_id = v_user
    AND is_admin_block = false
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_CANCELLABLE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.booking_slots
  SET is_reserved = false
  WHERE booking_id = p_booking_id;

  UPDATE public.payments
  SET status = 'failed'
  WHERE booking_id = p_booking_id AND status = 'pending';
END;
$$;

-- Do not expose cancelled sessions or every participant's name, payment state,
-- and identifier to any signed-in user. A participant receives only their own
-- row; administrators retain the full roster.
DROP POLICY IF EXISTS "Anyone can view scheduled open play sessions" ON public.open_play_sessions;
CREATE POLICY "Anyone can view scheduled open play sessions"
  ON public.open_play_sessions FOR SELECT
  USING (status = 'scheduled' OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.list_open_play_sessions(
  p_from date DEFAULT CURRENT_DATE,
  p_to date DEFAULT CURRENT_DATE + INTERVAL '60 days'
)
RETURNS TABLE (
  id uuid, session_date date, start_time time, end_time time, court_ids uuid[],
  skill public.open_play_skill, max_players int, price_php numeric,
  cancel_cutoff_hours int, status text, title text, notes text,
  registered_count bigint, waitlist_count bigint,
  my_status public.open_play_registration_status, my_waitlist_position int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.session_date, s.start_time, s.end_time, s.court_ids, s.skill,
         s.max_players, s.price_php, s.cancel_cutoff_hours, s.status, s.title, s.notes,
         COALESCE((SELECT count(*) FROM public.open_play_registrations r
                   WHERE r.session_id = s.id AND r.status IN ('registered', 'checked_in')), 0),
         COALESCE((SELECT count(*) FROM public.open_play_registrations r
                   WHERE r.session_id = s.id AND r.status = 'waitlisted'), 0),
         (SELECT r.status FROM public.open_play_registrations r
          WHERE r.session_id = s.id AND r.user_id = auth.uid() AND r.status <> 'cancelled' LIMIT 1),
         (SELECT r.waitlist_position FROM public.open_play_registrations r
          WHERE r.session_id = s.id AND r.user_id = auth.uid() AND r.status = 'waitlisted' LIMIT 1)
  FROM public.open_play_sessions s
  WHERE s.session_date BETWEEN p_from AND p_to
    AND (s.status = 'scheduled' OR public.has_role(auth.uid(), 'admin'))
  ORDER BY s.session_date, s.start_time;
$$;

-- The response adds checked_in_at for the caller's own registration, so the
-- old function must be dropped before its return signature is replaced.
DROP FUNCTION IF EXISTS public.get_open_play_roster(uuid);

CREATE FUNCTION public.get_open_play_roster(p_session_id uuid)
RETURNS TABLE (
  registration_id uuid, user_id uuid, status public.open_play_registration_status,
  waitlist_position int, payment_status public.payment_status,
  payment_reference text, full_name text, registered_at timestamptz, checked_in_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.id, r.user_id, r.status, r.waitlist_position, r.payment_status,
         r.payment_reference, p.full_name, r.registered_at, r.checked_in_at
  FROM public.open_play_registrations r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.session_id = p_session_id
    AND r.status <> 'cancelled'
    AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ORDER BY (r.status = 'waitlisted'), COALESCE(r.waitlist_position, 0), r.registered_at;
$$;

-- Require an authenticated user for every callable application RPC and remove
-- the default PUBLIC execute grant from newly-created functions.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_bookings_atomic(date, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_booking_reservation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_open_play_sessions(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_open_play_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bookings_atomic(date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_play_sessions(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_open_play_roster(uuid) TO authenticated;

-- Retire the legacy cron job. It sent an anonymous publishable token to an
-- administrative endpoint; the endpoint now requires a verified JWT and the
-- current booking trigger no longer assigns expirations. This prevents noisy,
-- unauthorized scheduled requests while keeping the endpoint protected for a
-- future authenticated scheduler.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-bookings'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

-- Rate-limit authenticated AI chat calls in the database, so a function isolate
-- restart cannot reset the quota. One row per user is retained and updated.
CREATE TABLE IF NOT EXISTS public.faq_chat_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);
ALTER TABLE public.faq_chat_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_faq_chat_quota()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.faq_chat_rate_limits AS q (user_id, window_started_at, request_count)
  VALUES (v_user, now(), 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_started_at = CASE
          WHEN q.window_started_at <= now() - interval '1 minute' THEN now()
          ELSE q.window_started_at
        END,
        request_count = CASE
          WHEN q.window_started_at <= now() - interval '1 minute' THEN 1
          ELSE q.request_count + 1
        END
  RETURNING request_count <= 10 INTO v_allowed;

  RETURN v_allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_faq_chat_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_faq_chat_quota() TO authenticated;
