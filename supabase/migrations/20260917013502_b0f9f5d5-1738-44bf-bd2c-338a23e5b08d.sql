CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  NEW.reference_code := COALESCE(
    NEW.reference_code,
    'PB' || to_char(now(), 'YYMMDD') || upper(encode(extensions.gen_random_bytes(6), 'hex'))
  );
  NEW.expires_at := NULL;
  RETURN NEW;
END;
$function$;