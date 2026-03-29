-- Column article inline images: public bucket + RLS (certified pros upload, public read, owner delete)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-images',
  'article-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Certified pros can upload article images" ON storage.objects;
CREATE POLICY "Certified pros can upload article images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'article-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_certified_pro = true
    )
  );

DROP POLICY IF EXISTS "Public article image access" ON storage.objects;
CREATE POLICY "Public article image access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'article-images');

DROP POLICY IF EXISTS "Users can delete own article images" ON storage.objects;
CREATE POLICY "Users can delete own article images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'article-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
