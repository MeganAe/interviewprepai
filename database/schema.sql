-- Interview Prep AI v3 — PostgreSQL / Supabase SQL Editor.
-- Run once with the schema owner (Supabase SQL Editor / postgres).
-- No automatic DDL on application startup. No Supabase Auth/Data API is used.
BEGIN;
CREATE TABLE IF NOT EXISTS public.users (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    salt text NOT NULL,
    hash text NOT NULL,
    is_paid boolean NOT NULL DEFAULT false,
    paid_at timestamp with time zone NULL,
    chariow_sale_id text NULL
);
-- Also supports upgrading an already imported PostgreSQL schema.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS chariow_sale_id text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_chariow_sale_unique
    ON public.users(chariow_sale_id) WHERE chariow_sale_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.records (
    id text PRIMARY KEY,
    "userId" text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    data text NOT NULL
);
CREATE INDEX IF NOT EXISTS records_user ON public.records("userId", kind);
-- Audit/idempotency survives account deletion. No customer name/email/phone or raw webhook.
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    sale_id text PRIMARY KEY,
    user_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
    product_id text NOT NULL,
    delivery_id text NULL,
    payload_sha256 text NOT NULL,
    received_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payment_receipts_user ON public.payment_receipts(user_id);
-- Reuse an active checkout instead of creating simultaneous duplicate purchases.
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
    user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    response text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);
-- ASP.NET cookie encryption keys must survive Render restarts/redeploys.
CREATE TABLE IF NOT EXISTS public.data_protection_keys (
    name text PRIMARY KEY,
    xml text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Prevent exposure of account hashes, payment flags and cookie keys via Supabase APIs.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_protection_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users, public.records, public.payment_receipts,
    public.checkout_sessions, public.data_protection_keys FROM PUBLIC;
-- These Supabase roles do not exist on a vanilla PostgreSQL test server.
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.users, public.records, public.payment_receipts, public.checkout_sessions, public.data_protection_keys FROM %I', r);
        END IF;
    END LOOP;
END $$;
COMMIT;

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
