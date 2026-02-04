-- Add columns for Video Feedback (Technique Check)
ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS coach_comment TEXT;

-- Optional: Create storage bucket if not exists (This often requires extension 'storage' which is usually enabled by default in Supabase, but creating buckets via SQL is specific)
-- We will assume the bucket 'workout-videos' is created or will be created manually if this fails.
-- But we can try to insert into storage.buckets if we have permissions.
INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-videos', 'workout-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for Public Read (if public=true) - simpler for MVP
-- Everyone can read
CREATE POLICY "Public Videos" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'workout-videos' );

-- Authenticated users can upload
CREATE POLICY "Authenticated Uploads" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'workout-videos' AND auth.role() = 'authenticated' );
