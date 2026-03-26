-- Phase 2: consultation_concerns RLS, list RPC, atomic create RPC
-- Run after 001_initial.sql

ALTER TABLE public.consultation_concerns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_concerns_select_published"
  ON public.consultation_concerns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_concerns.consultation_id
        AND c.status = 'published'
    )
  );

CREATE POLICY "consultation_concerns_insert_own"
  ON public.consultation_concerns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_concerns.consultation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.fetch_consultations(
  p_phase_id uuid DEFAULT NULL,
  p_sort text DEFAULT 'new',
  p_limit int DEFAULT 20,
  p_after_created_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_after_reply_count int DEFAULT NULL,
  p_after_view_count int DEFAULT NULL
)
RETURNS SETOF public.consultations
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  lim int := LEAST(COALESCE(NULLIF(p_limit, 0), 20), 50);
  s text := COALESCE(NULLIF(trim(p_sort), ''), 'new');
BEGIN
  IF s = 'replies' THEN
    RETURN QUERY
    SELECT c.*
    FROM public.consultations c
    WHERE c.status = 'published'
      AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (
        p_after_id IS NULL
        OR (c.reply_count, c.created_at, c.id) < (p_after_reply_count, p_after_created_at, p_after_id)
      )
    ORDER BY c.reply_count DESC, c.created_at DESC, c.id DESC
    LIMIT lim;
  ELSIF s = 'views' THEN
    RETURN QUERY
    SELECT c.*
    FROM public.consultations c
    WHERE c.status = 'published'
      AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (
        p_after_id IS NULL
        OR (c.view_count, c.created_at, c.id) < (p_after_view_count, p_after_created_at, p_after_id)
      )
    ORDER BY c.view_count DESC, c.created_at DESC, c.id DESC
    LIMIT lim;
  ELSE
    RETURN QUERY
    SELECT c.*
    FROM public.consultations c
    WHERE c.status = 'published'
      AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (
        p_after_id IS NULL
        OR (c.created_at, c.id) < (p_after_created_at, p_after_id)
      )
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT lim;
  END IF;
END;
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

  INSERT INTO public.consultations (user_id, phase_id, title, body, crisis_flag, status)
  VALUES (auth.uid(), p_phase_id, p_title, p_body, v_crisis, 'published')
  RETURNING id INTO v_id;

  INSERT INTO public.consultation_concerns (consultation_id, concern_id)
  SELECT v_id, d.id
  FROM (SELECT DISTINCT unnest(p_concern_ids) AS id) d;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_consultations(uuid, text, int, timestamptz, uuid, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_consultation_post(uuid, varchar, text, uuid[]) TO authenticated;
