-- Profile extension: avatars, headline, location, public profile, storage bucket

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS headline VARCHAR(60);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prefecture VARCHAR(10);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website_url TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_years_of_experience_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_years_of_experience_check
  CHECK (years_of_experience IS NULL OR (years_of_experience >= 0 AND years_of_experience <= 99));

-- Storage bucket (public read for avatar URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies for avatars
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
CREATE POLICY "Public avatar access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
