-- V5.1: application administrator managed only in Supabase/PostgreSQL.
-- Run in Supabase SQL Editor before deploying the v5.1 code.
-- No account is promoted automatically. Existing payment flags remain unchanged.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
-- If the column was created manually, reject non-boolean types and normalize nulls.
ALTER TABLE public.users ALTER COLUMN is_admin SET DEFAULT false;
UPDATE public.users SET is_admin=false WHERE is_admin IS NULL;
ALTER TABLE public.users ALTER COLUMN is_admin SET NOT NULL;
-- At most one true value, including concurrent/manual writes.
-- If multiple admins already exist, this fails and rolls back; none is chosen arbitrarily.
CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin ON public.users(is_admin) WHERE is_admin;
-- Keep roles/password hashes inaccessible through public Supabase APIs.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON public.users FROM %I',r);
  END IF;
 END LOOP;
END $$;
COMMIT;
