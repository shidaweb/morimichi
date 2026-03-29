-- ============================================================
-- Combined Migration: 008 + 009 + 010
-- Run this in Supabase SQL Editor (https://sgzylqvgqfajqmdmgkkp.supabase.co)
-- ============================================================

-- ============================================================
-- 008: contact_requests — rename target_pro_user_id → target_user_id + RLS
-- ============================================================

DROP POLICY IF EXISTS "Target pros can mark forwarded contact requests responded" ON public.contact_requests;
DROP POLICY IF EXISTS "Admins can update all contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Admins can read all contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Target pros can read forwarded contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Users can read own contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Authenticated users can create contact requests" ON public.contact_requests;

ALTER TABLE public.contact_requests RENAME COLUMN target_pro_user_id TO target_user_id;

CREATE POLICY "Authenticated users can create contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_user_id
    AND requester_user_id <> target_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles AS target
      WHERE target.user_id = target_user_id
        AND target.role IN ('advisor', 'both', 'admin')
    )
  );

CREATE POLICY "Users can read own contact requests"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = requester_user_id);

CREATE POLICY "Target pros can read forwarded contact requests"
  ON public.contact_requests FOR SELECT
  USING (
    auth.uid() = target_user_id
    AND status IN ('forwarded', 'responded', 'closed')
  );

CREATE POLICY "Admins can read all contact requests"
  ON public.contact_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all contact requests"
  ON public.contact_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Target pros can mark forwarded contact requests responded"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = target_user_id AND status = 'forwarded')
  WITH CHECK (auth.uid() = target_user_id AND status = 'responded');

-- ============================================================
-- 009: report reason enum + self-reaction block + full-text search
-- ============================================================

ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'auto_detected_contact_info';

DROP POLICY IF EXISTS "Logged in users can create reactions" ON public.reactions;
CREATE POLICY "Logged in users can create reactions"
  ON public.reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT (
      (
        target_type = 'consultation'
        AND EXISTS (
          SELECT 1 FROM public.consultations c
          WHERE c.id = reactions.target_id AND c.user_id = auth.uid()
        )
      )
      OR (
        target_type = 'reply'
        AND EXISTS (
          SELECT 1 FROM public.replies r
          WHERE r.id = reactions.target_id AND r.user_id = auth.uid()
        )
      )
    )
  );

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS title_body_search tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_consultations_title_body_search
  ON public.consultations USING GIN (title_body_search);

-- ============================================================
-- 010: article-images storage bucket + RLS
-- ============================================================

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
