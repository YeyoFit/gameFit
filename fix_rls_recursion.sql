-- FIX INFINITE RECURSION IN RLS

-- 1. Create a secure function to check role without triggering RLS
-- SECURITY DEFINER means this runs with the privileges of the creator (postgres/superuser), bypassing RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  RETURN _role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Super Admins can do anything on profiles" ON profiles;

-- 3. Create Safe Policies for Profiles

-- Policy A: Everyone can read their own profile (Required for Login/AuthContext)
CREATE POLICY "Users can read own profile"
    ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy B: Super Admins can do EVERYTHING (using the safe function)
CREATE POLICY "Super Admins can do everything"
    ON profiles
    FOR ALL
    USING (public.is_super_admin());

-- 4. Update other tables to use the safe function too (Optional reliability improvement)
-- (Existing policies on workouts/exercises might strictly fail if they recurse, but those check 'profiles' while accessing 'workouts', so they are NOT recursive on the same table. They are fine. But using the function is cleaner.)
DROP POLICY IF EXISTS "Super Admins can do anything on workouts" ON workouts;
CREATE POLICY "Super Admins can do anything on workouts"
    ON workouts
    FOR ALL
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admins can do anything on exercises" ON exercises;
CREATE POLICY "Super Admins can do anything on exercises"
    ON exercises
    FOR ALL
    USING (public.is_super_admin());
