-- Run manually in Supabase SQL Editor AFTER migration-v5.1.sql.
-- Replace the value below with the email of YOUR existing application account.
-- This transfers the role atomically, without changing is_paid or any payment.
-- No match -> error and rollback, preserving the previous admin.
DO $$
DECLARE
    selected_email text := 'REMPLACEZ-PAR-VOTRE-EMAIL';
    selected_id text;
BEGIN
    LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
    SELECT id INTO STRICT selected_id
    FROM public.users WHERE email = lower(btrim(selected_email));

    UPDATE public.users SET is_admin=false WHERE is_admin AND id<>selected_id;
    UPDATE public.users SET is_admin=true WHERE id=selected_id;
END $$;

SELECT id, name, email, is_admin, is_paid
FROM public.users WHERE is_admin;
