-- MASTER FIX: PROFILES & PERMISSIONS
-- Run this ENTIRE script in the Supabase SQL Editor.

-- Part 1: Ensure RLS Policies are Correct
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to insert/update THEIR OWN profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING ( exists (select 1 from profiles where id = auth.uid() and role = 'admin') );


-- Part 2: Force Repair for 'prueba1@xx.com'
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user ID based on email
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'prueba1@xx.com';
  
  IF target_user_id IS NOT NULL THEN
    -- Upsert the profile (Create if missing, Update if exists)
    INSERT INTO public.profiles (id, email, role)
    VALUES (target_user_id, 'prueba1@xx.com', 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', email = 'prueba1@xx.com';
    
    RAISE NOTICE 'Success: Profile for prueba1@xx.com has been fixed and set to Admin.';
  ELSE
    RAISE NOTICE 'Warning: User prueba1@xx.com not found. Check the email.';
  END IF;
END $$;
