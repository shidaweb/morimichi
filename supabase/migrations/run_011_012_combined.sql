-- 011 + 012 まとめて実行用（Supabase SQL Editor など）
-- 011: 通報 API 用 RLS（通報者の SELECT）+ 未処理重複の整理とユニークインデックス
-- 012: 相談キーワード検索用 pg_trgm + GIN インデックス

-- =============================================================================
-- 011_reports_reporter_select_and_dedupe.sql
-- =============================================================================

-- 通報者が INSERT ... RETURNING / .select() で自分の行を読めるようにする
DROP POLICY IF EXISTS "Reporters can read own reports" ON public.reports;
CREATE POLICY "Reporters can read own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_user_id);

-- 同一ユーザー・同一対象の「未処理」通報は1件に制限（重複通報 → 409）
DELETE FROM public.reports a
  USING public.reports b
WHERE a.ctid > b.ctid
  AND a.reporter_user_id = b.reporter_user_id
  AND a.target_type = b.target_type
  AND a.target_id = b.target_id
  AND a.status IN ('pending', 'reviewing')
  AND b.status IN ('pending', 'reviewing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_one_open_per_reporter_target
  ON public.reports (reporter_user_id, target_type, target_id)
  WHERE status IN ('pending', 'reviewing');

-- =============================================================================
-- 012_consultations_search_trgm.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_consultations_title_trgm
  ON public.consultations USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_consultations_body_trgm
  ON public.consultations USING gin (body gin_trgm_ops);
