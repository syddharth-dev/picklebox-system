BEGIN;

-- Session summaries contain schedule, skill, price and aggregate capacity only.
-- Registration rows, payment references and player profiles remain private.
REVOKE ALL ON FUNCTION public.list_open_play_sessions(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_play_sessions(date, date) TO anon, authenticated;

COMMIT;
