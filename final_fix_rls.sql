-- FINAL FIX FOR INFINITE LOADING / RECURSION

-- 1. Ensure the Security Definer Function exists
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
  _role text;
BEGIN
  -- This runs as database admin, skipping RLS
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  RETURN _role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop potential problematic policies (clean slate for roles)
DROP POLICY IF EXISTS "Super Admins can do anything on profiles" ON profiles;
DROP POLICY IF EXISTS "Super Admins can do everything" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;

-- 3. Update Constraint to ensure 'super_admin' is allowed
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'user', 'super_admin'));

-- 4. Re-create Safe Policies for Profiles

-- A. Users/Admins can read/update THEIR OWN profile (No recursion)
CREATE POLICY "Users can manage own profile"
    ON profiles
    FOR ALL
    USING (auth.uid() = id);

-- B. Super Admins can do EVERYTHING on profiles (Uses function -> No recursion)
CREATE POLICY "Super Admins can manage all profiles"
    ON profiles
    FOR ALL
    USING (public.is_super_admin());

-- 5. Fix Workouts Policies
DROP POLICY IF EXISTS "Super Admins can do anything on workouts" ON workouts;
CREATE POLICY "Super Admins can manage all workouts"
    ON workouts
    FOR ALL
    USING (public.is_super_admin());

-- 6. Fix Exercises Policies
DROP POLICY IF EXISTS "Super Admins can do anything on exercises" ON exercises;
CREATE POLICY "Super Admins can manage all exercises"
    ON exercises
    FOR ALL
    USING (public.is_super_admin());
