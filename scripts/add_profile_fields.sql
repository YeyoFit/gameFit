
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Policy tweaks if needed?
-- Existing policies likely allow users to update their own profile?
-- Generally "Users can update own profile" is standard. I will ensure it exists.

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
