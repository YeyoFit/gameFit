-- Allow public access for development (since we are using Mock Auth in frontend)

-- Workouts
alter table workouts enable row level security;
drop policy if exists "Enable all for everyone" on workouts;
create policy "Enable all for everyone" on workouts for all using (true) with check (true);

-- Workout Logs
alter table workout_logs enable row level security;
drop policy if exists "Enable all for everyone" on workout_logs;
create policy "Enable all for everyone" on workout_logs for all using (true) with check (true);
