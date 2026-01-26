
-- Create measurements table
CREATE TABLE IF NOT EXISTS client_measurements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recorded_at DATE DEFAULT CURRENT_DATE,
    weight NUMERIC NOT NULL,
    body_fat_percentage NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE client_measurements ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all measurements" ON client_measurements
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM profiles 
            WHERE role IN ('admin', 'super_admin')
        )
    );

-- Users can VIEW their own measurements (but not edit, per requirements "only admin can annotate")
CREATE POLICY "Users can view own measurements" ON client_measurements
    FOR SELECT
    USING (auth.uid() = user_id);

-- Optional: Allow users to view themselves? Yes "aparezca en el apartado Reports" implies they can see it.
