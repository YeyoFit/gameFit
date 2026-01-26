
-- Add prescription columns to workout_logs table
-- This allows defining targets, tempo, rest, and order for each logged set (or exercise group)

ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS target_reps text,   -- e.g. "8-12"
ADD COLUMN IF NOT EXISTS target_weight numeric,
ADD COLUMN IF NOT EXISTS tempo text,         -- e.g. "3-0-1-0"
ADD COLUMN IF NOT EXISTS rest_time text,     -- e.g. "90s"
ADD COLUMN IF NOT EXISTS exercise_order text; -- e.g. "A", "B1", "C"

-- Comment on columns
COMMENT ON COLUMN workout_logs.target_reps IS 'Target repetition range or specific count';
COMMENT ON COLUMN workout_logs.tempo IS 'Lifting tempo (Eccentric-Pause-Concentric-Pause)';
COMMENT ON COLUMN workout_logs.exercise_order IS 'Ordering of exercises within the workout (A, B, C...)';
