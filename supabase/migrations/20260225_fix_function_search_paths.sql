-- ============================================================
-- Fix mutable search_path on all public functions
-- ============================================================
-- Supabase security lint: function_search_path_mutable
-- Without a fixed search_path, a malicious user could create
-- objects in a schema that gets searched first, potentially
-- hijacking function behavior.
--
-- Setting search_path = '' forces all references to be
-- schema-qualified, preventing search path injection.
-- ============================================================

-- 1. update_updated_at_column (trigger function for updated_at columns)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. update_updated_at (alternate trigger function for updated_at)
ALTER FUNCTION public.update_updated_at() SET search_path = '';

-- 3. generate_invoice_number
ALTER FUNCTION public.generate_invoice_number() SET search_path = '';

-- 4. handle_new_user (auth trigger for creating user profiles)
ALTER FUNCTION public.handle_new_user() SET search_path = '';

-- 5. get_user_role (returns current user's role)
ALTER FUNCTION public.get_user_role() SET search_path = '';

-- 6. generate_reference_number
ALTER FUNCTION public.generate_reference_number() SET search_path = '';
