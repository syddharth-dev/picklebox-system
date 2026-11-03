-- Schedule cleanup of expired bookings every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-bookings',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://lkdmueujbxyeiqunpiso.supabase.co/functions/v1/cleanup-expired-bookings',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZG11ZXVqYnh5ZWlxdW5waXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzAwMjAsImV4cCI6MjA4NTYwNjAyMH0.yqe7BGwZCUJQvRqFs2xjPy8b-Qi_5Bh0WDkUDZsfwHQ"}'::jsonb,
    body:='{"time": "now"}'::jsonb
  ) AS request_id;
  $$
);