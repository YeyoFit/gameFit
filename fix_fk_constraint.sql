-- Drop the foreign key constraint to auth.users
-- This allows us to insert workouts with any user_id (like our mock ID) for testing purposes.

alter table workouts drop constraint if exists workouts_user_id_fkey;
