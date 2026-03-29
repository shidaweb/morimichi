-- Task 005: 通報者が INSERT ... RETURNING / .select() で自分の行を読めるようにする
-- （従来は SELECT がモデレーターのみのため 500 になっていた）

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
