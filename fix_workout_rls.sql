-- Allow selecting workouts for now (even with null user_id or different user_id)
-- Just ensuring the policy covers SELECT for all rows as we are still in "mock user" mode.
DROP POLICY IF EXISTS "Enable read access for all users" ON workouts;
CREATE POLICY "Enable read access for all users" ON workouts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON workouts;
CREATE POLICY "Enable insert for all users" ON workouts FOR INSERT WITH CHECK (true);
