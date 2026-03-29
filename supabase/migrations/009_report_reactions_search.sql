-- Phase 4: auto-flag report reason
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'auto_detected_contact_info';

-- Phase 7: block self-reactions at RLS
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

-- Phase 10: keyword search on consultations
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS title_body_search tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_consultations_title_body_search
  ON public.consultations USING GIN (title_body_search);
