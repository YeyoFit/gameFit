
-- ENFORCE SUPER ADMIN SECURITY

-- 1. Ensure the safe function exists
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
  _role text;
BEGIN
  -- Security Definer allows reading profiles even if RLS normally blocks it
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  RETURN _role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop policies to start fresh (Cleanup old AND new names)
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Super Admins can do everything" ON profiles;
DROP POLICY IF EXISTS "Super Admins can do anything on profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update users" ON profiles; 
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON profiles; -- Fix for collision

-- 3. Apply Strict Policies on PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- A. Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING ( auth.uid() = id );

-- B. Super Admins can do everything on profiles (Create, Read, Update, Delete)
CREATE POLICY "Super Admins can manage all profiles"
  ON profiles FOR ALL
  USING ( public.is_super_admin() );

-- 4. Apply Strict Policies on WORKOUTS
DROP POLICY IF EXISTS "Super Admins can do anything on workouts" ON workouts;
DROP POLICY IF EXISTS "Super Admins can manage all workouts" ON workouts; -- Fix for collision

-- A. Allow Super Admin to manage workouts
CREATE POLICY "Super Admins can manage all workouts"
  ON workouts FOR ALL
  USING ( public.is_super_admin() );

-- NOTE: Regular users keep existing policies defined in schema (own rows only)

-- 5. Helper: If user is "mazomalote@gmail.com", ensure they are super_admin
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'mazomalote@gmail.com';
