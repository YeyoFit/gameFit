-- Create exercises table
create table exercises (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phase text,
  body_part text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create workouts table
create table workouts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text,
  date date default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create workout_logs table
create table workout_logs (
  id uuid default uuid_generate_v4() primary key,
  workout_id uuid references workouts on delete cascade not null,
  exercise_id uuid references exercises not null,
  set_number integer not null,
  reps integer,
  weight numeric,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
-- For now, we'll allow public read access to exercises
alter table exercises enable row level security;

create policy "Exercises are viewable by everyone"
  on exercises for select
  using ( true );

-- For workouts and logs, users can only see/edit their own data
alter table workouts enable row level security;

create policy "Users can view their own workouts"
  on workouts for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own workouts"
  on workouts for insert
  with check ( auth.uid() = user_id );

alter table workout_logs enable row level security;

create policy "Users can view their own logs"
  on workout_logs for select
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_logs.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can insert their own logs"
  on workout_logs for insert
  with check (
    exists (
      select 1 from workouts
      where workouts.id = workout_logs.workout_id
      and workouts.user_id = auth.uid()
    )
  );
