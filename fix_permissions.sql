-- Enable Update and Delete for everyone (for now)
-- This fixes the "Cannot coerce..." error which happens when update returns 0 rows due to lack of permission.

create policy "Enable update for everyone" 
on exercises 
for update 
using (true) 
with check (true);

create policy "Enable delete for everyone" 
on exercises 
for delete 
using (true);
