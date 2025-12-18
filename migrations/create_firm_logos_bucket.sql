-- Create firm-logos storage bucket in Supabase
-- This bucket stores firm/company logo images

-- Step 1: Insert the bucket into storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'firm-logos',
  'firm-logos',
  true,  -- Public bucket for easy access
  5242880,  -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create RLS policies for the bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to upload firm logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to firm logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update firm logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete firm logos" ON storage.objects;

-- Allow authenticated users to upload firm logos
CREATE POLICY "Allow authenticated users to upload firm logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'firm-logos');

-- Allow public read access to firm logos
CREATE POLICY "Allow public read access to firm logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'firm-logos');

-- Allow authenticated users to update firm logos
CREATE POLICY "Allow authenticated users to update firm logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'firm-logos');

-- Allow authenticated users to delete firm logos
CREATE POLICY "Allow authenticated users to delete firm logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'firm-logos');

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Created firm-logos storage bucket';
    RAISE NOTICE '📊 Bucket is public with 5MB file size limit';
    RAISE NOTICE '🔒 RLS policies created for authenticated users';
    RAISE NOTICE '🖼️  Allowed MIME types: JPEG, PNG, GIF, WebP';
END $$;
