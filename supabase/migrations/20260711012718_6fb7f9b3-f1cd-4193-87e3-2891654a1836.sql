
-- Allow admins to update bookings and payments (for approve/deny)
CREATE POLICY "Admins can update bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update payments"
ON public.payments FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rewrite the atomic booking RPC to also populate booking_slots so OTHER
-- users can see the slot as reserved (booking_slots is readable to all
-- authenticated users; bookings is RLS-restricted to the owner).
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
  v_slot time;
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
    EXCEPTION WHEN unique_violation OR exclusion_violation THEN
      RAISE EXCEPTION 'SLOT_TAKEN:%:%', v_court, v_start USING ERRCODE = '23P01';
    END;

    -- Insert one booking_slots row per hour so all users see it as reserved
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

-- Make sure booking_slots is broadcast via realtime so live UI updates
ALTER TABLE public.booking_slots REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='booking_slots'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_slots';
  END IF;
END $$;
