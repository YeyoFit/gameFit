
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Verify if Body Part exists too, just in case, though error didn't complain about it.
-- ADD COLUMN IF NOT EXISTS body_part TEXT; 
