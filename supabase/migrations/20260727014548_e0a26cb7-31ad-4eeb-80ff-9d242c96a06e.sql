
-- Enums
CREATE TYPE public.open_play_skill AS ENUM ('all','2.5-3.0','3.5','4.0+');
CREATE TYPE public.open_play_registration_status AS ENUM ('registered','waitlisted','cancelled','checked_in','no_show');

-- Sessions
CREATE TABLE public.open_play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  court_ids uuid[] NOT NULL,
  skill public.open_play_skill NOT NULL DEFAULT 'all',
  max_players int NOT NULL CHECK (max_players > 0),
  price_php numeric(10,2) NOT NULL DEFAULT 0,
  cancel_cutoff_hours int NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'scheduled',
  title text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (status IN ('scheduled','cancelled','completed'))
);

GRANT SELECT ON public.open_play_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.open_play_sessions TO authenticated;
GRANT ALL ON public.open_play_sessions TO service_role;

ALTER TABLE public.open_play_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled open play sessions"
  ON public.open_play_sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins manage open play sessions"
  ON public.open_play_sessions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER open_play_sessions_updated_at
  BEFORE UPDATE ON public.open_play_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registrations
CREATE TABLE public.open_play_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.open_play_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.open_play_registration_status NOT NULL DEFAULT 'registered',
  waitlist_position int,
  payment_reference text,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX open_play_reg_active_unique
  ON public.open_play_registrations (session_id, user_id)
  WHERE status <> 'cancelled';

GRANT SELECT, INSERT, UPDATE ON public.open_play_registrations TO authenticated;
GRANT ALL ON public.open_play_registrations TO service_role;

ALTER TABLE public.open_play_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own registrations"
  ON public.open_play_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update registrations"
  ON public.open_play_registrations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER open_play_registrations_updated_at
  BEFORE UPDATE ON public.open_play_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: list sessions with counts and my status (public-safe)
CREATE OR REPLACE FUNCTION public.list_open_play_sessions(p_from date DEFAULT CURRENT_DATE, p_to date DEFAULT CURRENT_DATE + INTERVAL '60 days')
RETURNS TABLE (
  id uuid,
  session_date date,
  start_time time,
  end_time time,
  court_ids uuid[],
  skill public.open_play_skill,
  max_players int,
  price_php numeric,
  cancel_cutoff_hours int,
  status text,
  title text,
  notes text,
  registered_count bigint,
  waitlist_count bigint,
  my_status public.open_play_registration_status,
  my_waitlist_position int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.session_date, s.start_time, s.end_time, s.court_ids, s.skill,
         s.max_players, s.price_php, s.cancel_cutoff_hours, s.status, s.title, s.notes,
         COALESCE((SELECT count(*) FROM public.open_play_registrations r
                    WHERE r.session_id = s.id AND r.status IN ('registered','checked_in')), 0) AS registered_count,
         COALESCE((SELECT count(*) FROM public.open_play_registrations r
                    WHERE r.session_id = s.id AND r.status = 'waitlisted'), 0) AS waitlist_count,
         (SELECT r.status FROM public.open_play_registrations r
           WHERE r.session_id = s.id AND r.user_id = auth.uid() AND r.status <> 'cancelled' LIMIT 1) AS my_status,
         (SELECT r.waitlist_position FROM public.open_play_registrations r
           WHERE r.session_id = s.id AND r.user_id = auth.uid() AND r.status = 'waitlisted' LIMIT 1) AS my_waitlist_position
  FROM public.open_play_sessions s
  WHERE s.session_date BETWEEN p_from AND p_to
  ORDER BY s.session_date, s.start_time;
$$;

REVOKE EXECUTE ON FUNCTION public.list_open_play_sessions(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_play_sessions(date, date) TO authenticated;

-- RPC: session roster (registered + waitlist), visible to admin OR any authenticated (names only)
CREATE OR REPLACE FUNCTION public.get_open_play_roster(p_session_id uuid)
RETURNS TABLE (
  registration_id uuid,
  user_id uuid,
  status public.open_play_registration_status,
  waitlist_position int,
  payment_status public.payment_status,
  payment_reference text,
  full_name text,
  registered_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.user_id, r.status, r.waitlist_position,
         r.payment_status,
         CASE WHEN public.has_role(auth.uid(), 'admin') OR r.user_id = auth.uid()
              THEN r.payment_reference ELSE NULL END,
         p.full_name, r.registered_at
  FROM public.open_play_registrations r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.session_id = p_session_id
    AND r.status <> 'cancelled'
  ORDER BY (r.status = 'waitlisted'), COALESCE(r.waitlist_position, 0), r.registered_at;
$$;

REVOKE EXECUTE ON FUNCTION public.get_open_play_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_open_play_roster(uuid) TO authenticated;

-- RPC: register (atomic capacity check + waitlist assignment)
CREATE OR REPLACE FUNCTION public.register_for_open_play(p_session_id uuid, p_payment_reference text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session public.open_play_sessions;
  v_active_count int;
  v_next_wait int;
  v_status public.open_play_registration_status;
  v_position int;
  v_reg_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_session FROM public.open_play_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF v_session.status <> 'scheduled' THEN RAISE EXCEPTION 'SESSION_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;
  IF (v_session.session_date + v_session.start_time) < now() THEN
    RAISE EXCEPTION 'SESSION_ALREADY_STARTED' USING ERRCODE = 'P0001';
  END IF;
  IF v_session.price_php > 0 AND COALESCE(btrim(p_payment_reference), '') = '' THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.open_play_registrations
             WHERE session_id = p_session_id AND user_id = v_user AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'ALREADY_REGISTERED' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_active_count FROM public.open_play_registrations
   WHERE session_id = p_session_id AND status IN ('registered','checked_in');

  IF v_active_count < v_session.max_players THEN
    v_status := 'registered';
    v_position := NULL;
  ELSE
    SELECT COALESCE(max(waitlist_position), 0) + 1 INTO v_next_wait
      FROM public.open_play_registrations
     WHERE session_id = p_session_id AND status = 'waitlisted';
    v_status := 'waitlisted';
    v_position := v_next_wait;
  END IF;

  INSERT INTO public.open_play_registrations
    (session_id, user_id, status, waitlist_position, payment_reference, payment_status)
  VALUES
    (p_session_id, v_user, v_status, v_position,
     NULLIF(btrim(p_payment_reference), ''),
     CASE WHEN v_session.price_php = 0 THEN 'completed'::public.payment_status ELSE 'pending'::public.payment_status END)
  RETURNING id INTO v_reg_id;

  RETURN jsonb_build_object('registration_id', v_reg_id, 'status', v_status, 'waitlist_position', v_position);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_for_open_play(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_for_open_play(uuid, text) TO authenticated;

-- RPC: cancel own registration + promote first waitlist entry
CREATE OR REPLACE FUNCTION public.cancel_open_play_registration(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reg public.open_play_registrations;
  v_promoted uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_reg FROM public.open_play_registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REG_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF v_reg.user_id <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.open_play_registrations SET status = 'cancelled', waitlist_position = NULL
   WHERE id = p_registration_id;

  -- If this was an active registration slot, promote head of waitlist
  IF v_reg.status IN ('registered','checked_in') THEN
    UPDATE public.open_play_registrations
       SET status = 'registered', waitlist_position = NULL
     WHERE id = (
       SELECT id FROM public.open_play_registrations
        WHERE session_id = v_reg.session_id AND status = 'waitlisted'
        ORDER BY waitlist_position ASC NULLS LAST, registered_at ASC
        LIMIT 1
     )
    RETURNING user_id INTO v_promoted;

    -- Resequence remaining waitlist positions
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY waitlist_position, registered_at) AS rn
        FROM public.open_play_registrations
       WHERE session_id = v_reg.session_id AND status = 'waitlisted'
    )
    UPDATE public.open_play_registrations r
       SET waitlist_position = ranked.rn
      FROM ranked
     WHERE r.id = ranked.id;
  END IF;

  RETURN jsonb_build_object('cancelled', true, 'promoted_user_id', v_promoted);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_open_play_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_open_play_registration(uuid) TO authenticated;

-- RPC: admin mark check-in / no-show / paid
CREATE OR REPLACE FUNCTION public.admin_update_open_play_registration(
  p_registration_id uuid,
  p_status public.open_play_registration_status DEFAULT NULL,
  p_payment_status public.payment_status DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  UPDATE public.open_play_registrations
     SET status = COALESCE(p_status, status),
         payment_status = COALESCE(p_payment_status, payment_status)
   WHERE id = p_registration_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_open_play_registration(uuid, public.open_play_registration_status, public.payment_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_open_play_registration(uuid, public.open_play_registration_status, public.payment_status) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.open_play_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.open_play_registrations;
ALTER TABLE public.open_play_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.open_play_registrations REPLICA IDENTITY FULL;
