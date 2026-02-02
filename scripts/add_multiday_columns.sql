-- Add occurrences to workouts table
ALTER TABLE workouts 
ADD COLUMN IF NOT EXISTS occurrences INTEGER DEFAULT 1;

-- Add day_number to workout_logs table
ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;
