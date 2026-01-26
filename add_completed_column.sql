-- Add completed column to workout_logs
alter table workout_logs 
add column completed boolean default false;

-- Update existing logs to be false (templates) or true if you prefer.
-- For the user's "Mode 1" request (targets as placeholders), we want them false initially.
update workout_logs set completed = false;
