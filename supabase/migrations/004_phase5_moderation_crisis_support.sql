-- Phase 5: 危機キーワード（相談本文・タイトル）、モデレーション用RLS、支援リンク公開読取

-- タイトル・本文に危機語が含まれると crisis_flag を立てる（困りごとの triggers_crisis と併用）
CREATE OR REPLACE FUNCTION public.consultation_text_has_crisis_keywords(p_title text, p_body text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    lower(COALESCE(p_title, '') || ' ' || COALESCE(p_body, '')) ~* '(死にたい|消えたい|楽になりたい|自殺|自害|死のう|なくなりたい|いなくなりたい|命を絶つ)',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.create_consultation_post(
  p_phase_id uuid,
  p_title varchar(100),
  p_body text,
  p_concern_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_crisis boolean;
  v_bad int;
BEGIN
  IF p_concern_ids IS NULL OR COALESCE(array_length(p_concern_ids, 1), 0) < 1 THEN
    RAISE EXCEPTION 'concerns_required';
  END IF;

  SELECT COUNT(*) INTO v_bad
  FROM (SELECT DISTINCT unnest(p_concern_ids) AS id) x
  LEFT JOIN public.concerns c
    ON c.id = x.id AND c.phase_id = p_phase_id AND COALESCE(c.is_active, true)
  WHERE c.id IS NULL;

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invalid_concerns';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.concerns c
    WHERE c.id = ANY (p_concern_ids) AND COALESCE(c.triggers_crisis, false)
  ) INTO v_crisis;

  v_crisis := v_crisis OR public.consultation_text_has_crisis_keywords(p_title, p_body);

  INSERT INTO public.consultations (user_id, phase_id, title, body, crisis_flag, status)
  VALUES (auth.uid(), p_phase_id, p_title, p_body, v_crisis, 'published')
  RETURNING id INTO v_id;

  INSERT INTO public.consultation_concerns (consultation_id, concern_id)
  SELECT v_id, d.id
  FROM (SELECT DISTINCT unnest(p_concern_ids) AS id) d;

  RETURN v_id;
END;
$$;

-- モデレーター: 相談の非公開化・削除
CREATE POLICY "Moderators can update consultations for moderation"
  ON public.consultations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Moderators can read all consultations"
  ON public.consultations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  );

-- モデレーター: 返信の非公開化・削除
CREATE POLICY "Moderators can update replies for moderation"
  ON public.replies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Moderators can read all replies"
  ON public.replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  );

-- 通報ステータス更新
CREATE POLICY "Moderators can update reports"
  ON public.reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  );

-- moderation_actions
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators can insert moderation_actions"
  ON public.moderation_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Moderators can read moderation_actions"
  ON public.moderation_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('moderator', 'admin')
    )
  );

-- 支援リンク（匿名でも閲覧可）
ALTER TABLE public.support_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active support links"
  ON public.support_links
  FOR SELECT
  USING (COALESCE(is_active, true) = true);
