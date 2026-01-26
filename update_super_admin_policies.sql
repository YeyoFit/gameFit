-- 1. Update Profiles Table Constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'user', 'super_admin'));

-- 2. Update RLS Policies for Profiles
-- Super Admins can do everything on profiles
CREATE POLICY "Super Admins can do anything on profiles"
    ON profiles
    FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- 3. Update RLS Policies for Workouts
-- Super Admins can do everything on workouts
CREATE POLICY "Super Admins can do anything on workouts"
    ON workouts
    FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- 4. Update RLS Policies for Exercises
-- Super Admins can do everything on exercises
CREATE POLICY "Super Admins can do anything on exercises"
    ON exercises
    FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );
