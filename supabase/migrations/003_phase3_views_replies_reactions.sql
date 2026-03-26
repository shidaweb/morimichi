-- Phase 3: 閲覧カウントトリガー、返信の自己宣言カラム、相談への共感カウント同期、consultation_views RLS

ALTER TABLE public.replies
  ADD COLUMN IF NOT EXISTS personal_opinion_ack BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.replies.personal_opinion_ack IS 'depth=1 の回答で「個人的見解」同意が必須';

-- 公開相談への閲覧記録（IPハッシュで重複排除）→ view_count を加算
CREATE OR REPLACE FUNCTION public.bump_consultation_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultations
  SET view_count = COALESCE(view_count, 0) + 1,
      updated_at = now()
  WHERE id = NEW.consultation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_consultation_views_bump ON public.consultation_views;
CREATE TRIGGER tr_consultation_views_bump
  AFTER INSERT ON public.consultation_views
  FOR EACH ROW
  EXECUTE PROCEDURE public.bump_consultation_view_count();

-- 返信が増えたら reply_count を加算（公開のみ）
CREATE OR REPLACE FUNCTION public.bump_consultation_reply_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' THEN
    UPDATE public.consultations
    SET reply_count = COALESCE(reply_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.consultation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_replies_reply_count ON public.replies;
CREATE TRIGGER tr_replies_reply_count
  AFTER INSERT ON public.replies
  FOR EACH ROW
  EXECUTE PROCEDURE public.bump_consultation_reply_count();

-- 相談への共感で reaction_count を同期
CREATE OR REPLACE FUNCTION public.sync_consultation_reaction_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'consultation' THEN
      UPDATE public.consultations
      SET reaction_count = COALESCE(reaction_count, 0) + 1,
          updated_at = now()
      WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type = 'consultation' THEN
      UPDATE public.consultations
      SET reaction_count = GREATEST(COALESCE(reaction_count, 0) - 1, 0),
          updated_at = now()
      WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_reactions_consultation_count ON public.reactions;
CREATE TRIGGER tr_reactions_consultation_count
  AFTER INSERT OR DELETE ON public.reactions
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_consultation_reaction_count();

ALTER TABLE public.consultation_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_consultation_view_published"
  ON public.consultation_views
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_views.consultation_id
        AND c.status = 'published'
    )
    AND (viewer_id IS NULL OR viewer_id = auth.uid())
  );
