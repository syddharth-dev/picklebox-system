-- Read-only catalog checks. Run as the migration operator in staging before
-- deployment, then again after deployment. Do not paste credentials or tokens.

-- Public API tables must have RLS; future tables need explicit grants/policies.
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS player_select,
       has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS player_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname;

-- SECURITY DEFINER is a privileged API boundary. Anonymous execution should
-- not be available on application RPCs. Check unexpected functions too.
SELECT p.oid::regprocedure AS function_signature, p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS player_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
ORDER BY p.proname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- The legacy function body is absent from version control. It must be disabled
-- for API callers, whether or not it exists in the hosted schema.
SELECT to_regprocedure('public.create_booking_reservation(uuid,date,time without time zone[],text)')
  AS retired_rpc_signature;

-- These should be false after the security migration.
SELECT has_schema_privilege('authenticated', 'public', 'CREATE') AS player_schema_create,
       has_table_privilege('authenticated', 'public.booking_slots', 'SELECT') AS player_raw_slots,
       has_table_privilege('authenticated', 'public.user_roles', 'INSERT') AS player_role_insert,
       has_column_privilege('authenticated', 'public.profiles', 'user_id', 'UPDATE') AS player_profile_identity_update;

-- NOT VALID constraints intentionally protect new writes without deleting or
-- rewriting legacy data. Review old invalid values before validating them.
SELECT conrelid::regclass AS table_name, conname, convalidated
FROM pg_constraint WHERE connamespace = 'public'::regnamespace
  AND contype = 'c' AND NOT convalidated ORDER BY conrelid::regclass::text, conname;

-- Return counts rather than customer records.
SELECT count(*) FILTER (WHERE end_time <= start_time) AS nonpositive_duration,
       count(*) FILTER (WHERE total_amount < 0 OR total_amount = 'NaN'::numeric) AS invalid_amount
FROM public.bookings;
