-- OPTIMIZED ROLE FETCHING (Bypass RLS issues)

-- 1. Create a secure function to get the current user's role directly
-- This avoids "selecting from profiles" in the client, which can trigger RLS loops
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  _role text;
BEGIN
  -- Verify the user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN null;
  END IF;

  -- Fetch role directly (Bypassing RLS because it's SECURITY DEFINER)
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  
  RETURN _role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role TO anon; -- Allow anon to try (will return null)

-- 3. (Optional but recommended) Re-apply the is_super_admin function just in case
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  RETURN _role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
