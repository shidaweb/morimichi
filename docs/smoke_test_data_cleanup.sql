-- Task 008: スモークテストで作成したデータの削除用（本番はバックアップ確認のうえ Supabase SQL Editor で手動実行）
-- QA 用相談 259352c5-5bc0-4078-9b21-04f5db4c111c は運用で残す場合はリストから外す

DELETE FROM public.consultations
WHERE id IN (
  '47d439dc-c440-42d5-add3-89979620f58f',
  'e18db1f9-f657-4747-8c28-6dd1829daffb',
  '26765e8b-26be-4f03-b75b-87912cd50a7b',
  '9f9f6775-e36a-46b5-8635-0548f1100d0e',
  'fa9f663d-5126-4d27-ab56-add708bb58ba',
  '84160ce3-64f1-42c2-a270-0fc1b84a29eb'
);

-- テストユーザーのコンタクトリクエスト（UUID は環境ごとに差し替え）
-- DELETE FROM public.contact_requests
-- WHERE requester_user_id IN (
--   '66682971-9f34-4308-92b3-fc19b5dde8fd',
--   '6aa575ff-ac3e-4848-a0ef-9877fc1fd71e'
-- );
