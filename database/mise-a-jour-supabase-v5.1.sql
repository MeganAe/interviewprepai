-- Mise à jour cumulative : support v5 puis rôle SQL v5.1. Aucune attribution automatique.

-- V5: additive / repeatable. Run in Supabase SQL Editor BEFORE deploying v5.
-- No changes to users, passwords, payments, CVs or cookie keys. No admin email embedded.
BEGIN;
CREATE TABLE IF NOT EXISTS public.support_tickets (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 subject text NOT NULL CHECK (char_length(subject) BETWEEN 4 AND 140),
 category text NOT NULL CHECK (category IN ('general','technical','billing','privacy')),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','waiting','closed')),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_tickets_owner ON public.support_tickets(user_id,updated_at DESC,id);
CREATE INDEX IF NOT EXISTS support_tickets_queue ON public.support_tickets(status,updated_at DESC,id);
CREATE TABLE IF NOT EXISTS public.support_messages (
 id uuid PRIMARY KEY,
 ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
 author_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
 from_admin boolean NOT NULL DEFAULT false,
 body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 6000),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_messages_thread ON public.support_messages(ticket_id,created_at,id);
CREATE TABLE IF NOT EXISTS public.site_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_tickets,public.support_messages,public.site_settings FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON public.support_tickets,public.support_messages,public.site_settings FROM %I',r);
  END IF;
 END LOOP;
END $$;
COMMIT;

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
