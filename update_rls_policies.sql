-- Enable RLS on tables (just in case)
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- 1. POLICIES FOR WORKOUTS

-- Allow Admins to do EVERYTHING on workouts
DROP POLICY IF EXISTS "Admins can do everything on workouts" ON workouts;
CREATE POLICY "Admins can do everything on workouts" ON workouts
  FOR ALL
  USING (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Allow Users to VIEW their own assigned workouts
DROP POLICY IF EXISTS "Users can view own workouts" ON workouts;
CREATE POLICY "Users can view own workouts" ON workouts
  FOR SELECT
  USING ( auth.uid() = user_id );

-- 2. POLICIES FOR WORKOUT_LOGS

-- Allow Admins to do EVERYTHING on logs
DROP POLICY IF EXISTS "Admins can do everything on logs" ON workout_logs;
CREATE POLICY "Admins can do everything on logs" ON workout_logs
  FOR ALL
  USING (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Allow Users to VIEW logs for their workouts
DROP POLICY IF EXISTS "Users can view own logs" ON workout_logs;
CREATE POLICY "Users can view own logs" ON workout_logs
  FOR SELECT
  USING (
    exists (
      select 1 from workouts
      where workouts.id = workout_logs.workout_id
      and workouts.user_id = auth.uid()
    )
  );

-- Allow Users to UPDATE/INSERT logs for their workouts (logging data)
DROP POLICY IF EXISTS "Users can update own logs" ON workout_logs;
CREATE POLICY "Users can update own logs" ON workout_logs
  FOR UPDATE
  USING (
    exists (
      select 1 from workouts
      where workouts.id = workout_logs.workout_id
      and workouts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own logs" ON workout_logs;
CREATE POLICY "Users can insert own logs" ON workout_logs
  FOR INSERT
  WITH CHECK (
    exists (
      select 1 from workouts
      where workouts.id = workout_logs.workout_id
      and workouts.user_id = auth.uid()
    )
  );
