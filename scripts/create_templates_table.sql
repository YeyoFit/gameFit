
CREATE TABLE IF NOT EXISTS workout_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id),
    exercise_order VARCHAR(10) NOT NULL, -- "A1", "B1"
    target_sets INT DEFAULT 3,
    target_reps VARCHAR(20) DEFAULT '8-12', 
    tempo VARCHAR(10),
    rest_time INT DEFAULT 60,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access templates" ON workout_templates
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
      )
    );

-- Users can VIEW templates
CREATE POLICY "Anyone can view templates" ON workout_templates
    FOR SELECT TO authenticated USING (true);
    
-- Same for template items
CREATE POLICY "Admins full access template items" ON workout_template_exercises
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
      )
    );

CREATE POLICY "Anyone can view template items" ON workout_template_exercises
    FOR SELECT TO authenticated USING (true);
