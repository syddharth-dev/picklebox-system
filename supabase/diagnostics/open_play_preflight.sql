-- Read-only deployment checks. Review returned rows before enabling the new
-- Open Play guards. These queries never cancel sessions or alter payment data.

-- Invalid session configuration (the new NOT VALID checks preserve old data).
SELECT id, session_date, price_php, cancel_cutoff_hours, max_players
FROM public.open_play_sessions
WHERE price_php < 0 OR price_php = 'NaN'::numeric OR cancel_cutoff_hours < 0
   OR max_players <= 0 OR end_time <= start_time;

-- Missing, duplicate, null, deleted, or inactive court assignments.
SELECT s.id, s.court_ids
FROM public.open_play_sessions s
WHERE s.status = 'scheduled' AND (
  cardinality(s.court_ids) = 0 OR array_position(s.court_ids, NULL) IS NOT NULL
  OR cardinality(s.court_ids) <> (SELECT count(DISTINCT id) FROM unnest(s.court_ids) id)
  OR cardinality(s.court_ids) <> (SELECT count(*) FROM public.courts c WHERE c.id = ANY(s.court_ids) AND c.is_active)
);

-- Existing overlapping sessions. Resolve these with the venue; do not delete
-- registrations automatically, since they may have verified payments.
SELECT a.id AS first_session, b.id AS second_session, a.session_date
FROM public.open_play_sessions a JOIN public.open_play_sessions b
  ON a.id < b.id AND a.session_date = b.session_date AND a.court_ids && b.court_ids
 AND a.start_time < b.end_time AND a.end_time > b.start_time
WHERE a.status = 'scheduled' AND b.status = 'scheduled';

-- Existing clashes with court bookings or maintenance blocks.
SELECT s.id AS session_id, b.id AS booking_id, s.session_date
FROM public.open_play_sessions s JOIN public.bookings b
  ON b.court_id = ANY(s.court_ids) AND b.booking_date = s.session_date
 AND b.start_time < s.end_time AND b.end_time > s.start_time
WHERE s.status = 'scheduled' AND b.status IN ('pending', 'paid', 'completed');

-- Capacity violations in existing data.
SELECT s.id, s.max_players, count(r.id) AS active_registrations
FROM public.open_play_sessions s JOIN public.open_play_registrations r ON r.session_id = s.id
WHERE s.status = 'scheduled' AND r.status IN ('registered', 'checked_in')
GROUP BY s.id, s.max_players HAVING count(r.id) > s.max_players;

-- Historical manual check-ins which need payment/attendance review.
SELECT id, session_id, status, payment_status, checked_in_at
FROM public.open_play_registrations
WHERE status = 'checked_in' AND (checked_in_at IS NULL OR payment_status <> 'completed');
