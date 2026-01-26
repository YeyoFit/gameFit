-- Ensure workouts are deleted when a user is deleted
ALTER TABLE workouts
DROP CONSTRAINT IF EXISTS workouts_user_id_fkey;

ALTER TABLE workouts
ADD CONSTRAINT workouts_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Ensure logs are deleted when a workout is deleted (this is usually present but good to reinforce)
ALTER TABLE workout_logs
DROP CONSTRAINT IF EXISTS workout_logs_workout_id_fkey;

ALTER TABLE workout_logs
ADD CONSTRAINT workout_logs_workout_id_fkey
FOREIGN KEY (workout_id)
REFERENCES workouts(id)
ON DELETE CASCADE;

-- Ensure profile is deleted (usually handled by Supabase trigger, but let's be safe if we rely on manual profile cleanup or auth deletion)
-- Note: auth.users deletion usually cascades to profiles due to the foreign key on profiles.id = auth.users.id
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
