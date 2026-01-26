-- CLEANUP AND FIX POLICIES
-- We do NOT run 'create table' here because it already exists.

-- 1. Ensure RLS is on
alter table exercises enable row level security;

-- 2. Remove old conflicting policies if they exist
drop policy if exists "Authenticated users can insert exercises" on exercises;
drop policy if exists "Enable insert for everyone" on exercises;

-- 3. Add the temporary permissive policy
create policy "Enable insert for everyone" 
on exercises 
for insert 
with check (true);
