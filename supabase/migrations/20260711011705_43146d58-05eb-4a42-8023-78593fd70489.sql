
-- 1) Overlap guard: only active bookings reserve a slot
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop any legacy constraint/index if present
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_double_booking;
DROP INDEX IF EXISTS public.no_double_booking;
DROP INDEX IF EXISTS public.bookings_active_slot_unique;

-- Partial unique index: exact same start on the same court/date can't repeat while active
CREATE UNIQUE INDEX bookings_active_slot_unique
  ON public.bookings (court_id, booking_date, start_time)
  WHERE status IN ('pending','paid','completed');

-- Exclusion constraint: also blocks any time-range overlap (future-proofs multi-hour bookings)
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    court_id WITH =,
    booking_date WITH =,
    tsrange(
      ('2000-01-01'::date + start_time)::timestamp,
      ('2000-01-01'::date + end_time)::timestamp,
      '[)'
    ) WITH &&
  ) WHERE (status IN ('pending','paid','completed'));

-- 2) Atomic multi-booking RPC
CREATE OR REPLACE FUNCTION public.create_bookings_atomic(
  p_date date,
  p_reference text,
  p_items jsonb
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_booking_id uuid;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_court uuid;
  v_start time;
  v_end time;
  v_amount numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No booking items provided' USING ERRCODE = '22023';
  END IF;

  IF p_reference IS NULL OR length(btrim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Payment reference required' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_court  := (v_item->>'court_id')::uuid;
    v_start  := (v_item->>'start_time')::time;
    v_end    := (v_item->>'end_time')::time;
    v_amount := (v_item->>'amount')::numeric;

    BEGIN
      INSERT INTO public.bookings
        (user_id, court_id, booking_date, start_time, end_time, total_amount, status)
      VALUES
        (v_user, v_court, p_date, v_start, v_end, v_amount, 'pending')
      RETURNING id INTO v_booking_id;
    EXCEPTION
      WHEN unique_violation OR exclusion_violation THEN
        RAISE EXCEPTION 'SLOT_TAKEN:%:%', v_court, v_start
          USING ERRCODE = '23P01';
    END;

    INSERT INTO public.payments
      (booking_id, user_id, amount, payment_method, transaction_reference, status)
    VALUES
      (v_booking_id, v_user, v_amount, 'gcash', btrim(p_reference), 'pending');

    v_ids := array_append(v_ids, v_booking_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bookings_atomic(date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bookings_atomic(date, text, jsonb) TO authenticated;

-- 3) Realtime for live availability
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings';
  END IF;
END $$;
