
CREATE TABLE IF NOT EXISTS client_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    front_url TEXT,
    back_url TEXT,
    side_url TEXT,
    weight NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE client_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own photos" ON client_photos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own photos" ON client_photos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins/Trainers should be able to view all (via existing enforce_super_admin policies usually, 
-- or we can add specific policy if the super_admin policy is global or table specific.
-- Assuming super_admin policy needs to be added for this new table if not covered by a blanket rule)

CREATE POLICY "Admins can view all photos" ON client_photos
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
      )
    );
