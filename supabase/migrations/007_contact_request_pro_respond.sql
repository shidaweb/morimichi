-- Allow certified pros to mark forwarded contact requests as responded (D-6 email flow).
--
-- 適用時の注意:
--   - 006_certified_pro.sql（contact_requests テーブルと既存 RLS）適用済みであること。
--   - 管理者向け「Admins can update all contact requests」と併用（どちらかのポリシーが通れば UPDATE 可）。
--   - 対象プロのみ: status = 'forwarded' の行を 'responded' に更新できる（他カラム変更も同一トランザクション内なら可能だが、WITH CHECK で status は必ず responded）。

DROP POLICY IF EXISTS "Target pros can mark forwarded contact requests responded" ON public.contact_requests;
CREATE POLICY "Target pros can mark forwarded contact requests responded"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = target_pro_user_id AND status = 'forwarded')
  WITH CHECK (auth.uid() = target_pro_user_id AND status = 'responded');
