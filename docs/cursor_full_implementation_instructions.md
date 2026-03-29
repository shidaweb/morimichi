# もりみち 全未実装機能 — Cursor 一括実装指示書

> **この文書の使い方**: この1枚のMDに、morimichi.cc で未実装のすべての機能をフェーズ別にまとめています。
> Cursorに渡して **Phase 1 から順番に** 実装してください。各 Phase 完了後に動作確認してから次に進むこと。
> 技術スタック: Next.js 15 (App Router) + Cloudflare Workers (@opennextjs/cloudflare) + Supabase + shadcn/ui + Resend + Tiptap

---

## 全体像: 実装すべき機能一覧

| Phase | 優先度 | 機能 | 工数目安 |
|-------|--------|------|---------|
| 1 | 🔴 CRITICAL | プロフィール拡張（アバター・マイページ・公開プロフ） | 2日 |
| 2 | 🔴 CRITICAL | 回答者プロフィール閲覧導線の修正 | 1日 |
| 3 | 🔴 CRITICAL | 運営経由の回答者紹介を全回答者に拡張 | 1日 |
| 4 | 🟡 HIGH | DM防止策（3段階） | 1日 |
| 5 | 🟡 HIGH | 公認再生プロ（申請・審査・バッジ・一覧） | 3日 |
| 6 | 🟡 HIGH | コラム記事（Tiptapエディタ・画像・SNS共有・OGP） | 3日 |
| 7 | 🟡 HIGH | リアクション仕様の確定・depth制限の強化 | 1日 |
| 8 | 🟠 MEDIUM | メール送信の全ポイント実装・QA | 2日 |
| 9 | 🟠 MEDIUM | HTMLサニタイズ設定 | 0.5日 |
| 10 | 🟠 MEDIUM | 相談一覧キーワード検索 | 0.5日 |
| 11 | 🔧 QA | CSS transition修正・UI安定化 | 1日 |

---

## Phase 1: プロフィール拡張（アバター・マイページ充実・公開プロフィール）

### 1-1. DB マイグレーション

```
Cursorプロンプト:

以下のSQLを Supabase で実行してください。

-- ======== profiles テーブルへのカラム追加 ========
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS headline VARCHAR(60);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prefecture VARCHAR(10);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_of_experience INTEGER CHECK (years_of_experience >= 0 AND years_of_experience <= 99);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website_url TEXT;

-- ======== Supabase Storage: avatars バケット ========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ======== Storage RLS ========
CREATE POLICY "Public avatar access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 1-2. アバターアップロード API

```
Cursorプロンプト:

以下の2つのAPIエンドポイントを実装してください。

===== POST /api/users/me/avatar =====

ファイル: src/app/api/users/me/avatar/route.ts

- multipart/form-data でファイル受付
- バリデーション: 1MB以下、MIME type: image/jpeg, image/png, image/webp
- ★重要: Cloudflare Workers では sharp が使えないため、画像リサイズはクライアント側で行う
- ファイル名: avatars/{user_id}/avatar.webp（常に上書き）
- Supabase Storage にアップロード後、profiles.avatar_url を更新
- レスポンス: { "avatar_url": "https://<project>.supabase.co/storage/v1/object/public/avatars/{user_id}/avatar.webp" }

===== DELETE /api/users/me/avatar =====

ファイル: src/app/api/users/me/avatar/route.ts

- Storage からファイル削除
- profiles.avatar_url を null に更新
- レスポンス: { "message": "Avatar deleted" }
```

### 1-3. クライアントサイド画像リサイズ

```
Cursorプロンプト:

src/lib/utils/image-resize.ts を作成してください。

Canvas API を使って、アップロード前にクライアントサイドで画像を 200x200px の正方形にリサイズし、WebP に変換する関数:

export async function resizeAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')!

      // 正方形クロップ（中央基準）
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2

      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/webp',
        0.85
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

この関数をアバターアップロードコンポーネントから呼び出すようにしてください。
```

### 1-4. コンポーネント実装

```
Cursorプロンプト:

以下のコンポーネントを作成してください。

1. src/components/ui/user-avatar.tsx — 共通アバターコンポーネント

   Props: avatarUrl: string | null, nickname: string, size: 'sm'|'md'|'lg'|'xl'
   サイズマップ: sm=32px(ヘッダー), md=40px(一覧), lg=48px(詳細), xl=96px(マイページ)
   フォールバック: ニックネーム頭文字のイニシャル、背景色はニックネームから決定論的に生成
   shadcn/ui の Avatar, AvatarImage, AvatarFallback を使用

2. src/components/profile/avatar-upload.tsx — アバターアップロードコンポーネント

   - ドラッグ&ドロップ対応
   - プレビュー表示
   - アップロード中ローディング
   - 削除ボタン
   - resizeAvatar() でリサイズ後にAPIへ送信

3. UserAvatar を以下の全箇所に配置:
   - ヘッダー（ログイン後）: size="sm"
   - 相談カード一覧: size="md"
   - 相談詳細（投稿者）: size="lg"
   - 返信（各回答者）: size="md"
   - マイページ: size="xl"
```

### 1-5. マイページ リニューアル

```
Cursorプロンプト:

マイページ（/mypage）を以下のレイアウトにリニューアルしてください。

┌─────────────────────────────────────────┐
│  ┌──────┐                               │
│  │avatar│  ニックネーム                  │
│  │ (xl) │  肩書き（headline）             │
│  └──────┘  東京都 ・ 経験15年 ・ 回答者    │
│  [プロフィールを編集]                     │
│                                          │
│  ─── 自己紹介 ───                       │
│  bio テキスト                            │
│                                          │
│  ─── 経験フェーズ ───                   │
│  [💰 資金繰り] [⚖️ 破産] [🔄 再生]     │
│                                          │
│  ─── 活動サマリー ───                   │
│  ┌────────┬────────┬────────┐           │
│  │相談 3件 │回答 42件│共感 128 │           │
│  └────────┴────────┴────────┘           │
│                                          │
│  ─── 最近の活動 ───                     │
│  [タブ: 自分の相談 | 自分の回答]          │
│  ▸ 資金繰りについて...        3日前      │
│                                          │
│  ─── 設定 ───                           │
│  通知設定 >  ロール変更 >  退会 >        │
└─────────────────────────────────────────┘

プロフィール編集はモーダルで:
- アバター変更/削除
- ニックネーム（2-20文字）
- 肩書き（60文字以下）
- 自己紹介（500文字以下）
- 都道府県（47都道府県セレクト）
- 経営経験年数
- 経験フェーズ（複数選択チェックボックス、回答者のみ）
- ウェブサイト/SNS URL
- ☑ プロフィールを公開する（回答者のみ表示）

PATCH /api/users/me に新フィールドを追加してバリデーション。
```

### 1-6. 公開プロフィールページ

```
Cursorプロンプト:

/users/:nickname の公開プロフィールページを新規作成してください。

ファイル: src/app/(public)/users/[nickname]/page.tsx

GET /api/users/:nickname API:
- advisor/both ロールの回答者のみ表示
- consulter ロールは 404
- is_profile_public = true: フル情報（bio, prefecture, years_of_experience, website_url 含む）
- is_profile_public = false: 最低限情報のみ（下記参照）

★ CRITICAL: is_profile_public = false の回答者でも以下は常に表示:
{
  "nickname": "...",
  "avatar_url": "...",
  "experience_phases": [...],
  "is_certified_pro": true/false,
  "stats": {
    "total_replies": 42,
    "total_reactions_received": 128,
    "member_since": "2026-01-15"
  }
}
is_profile_public = false の場合は「このユーザーは詳細プロフィールを公開していません」と表示。

両方のケースで:
- 「運営を通じてこの人に相談する」ボタンを表示（Phase 3 で実装するが、ボタン枠だけ先に配置）
- この回答者の最近の回答一覧を表示（最新5件）
```

### Phase 1 テスト

```
以下を動作確認してください:
- [ ] アバター画像をアップロードし、マイページに表示される
- [ ] アバターがヘッダー、相談一覧、相談詳細、返信にも表示される
- [ ] アバター未設定時にイニシャルアイコンが表示される
- [ ] プロフィール編集で全フィールドが保存・表示される
- [ ] /users/:nickname で公開プロフィールが閲覧できる（回答者のみ）
- [ ] 相談者のプロフィールにアクセスすると 404
```

---

## Phase 2: 回答者プロフィール閲覧導線

```
Cursorプロンプト:

相談詳細ページで、回答者のニックネームとアバターをクリック可能にしてください。

1. 相談詳細ページ（/consultations/:id）の各回答（depth=1 の返信）:
   - 回答者のニックネームを <Link href="/users/{nickname}"> に変更
   - アバターもクリッカブルに（同じリンク先）
   - 回答者の横に is_certified_pro = true の場合は金色バッジ表示（Phase 5 で作成するコンポーネントの枠だけ準備）

2. 相談一覧ページ（/consultations）の各相談カード:
   - 投稿者のニックネームは相談者なのでリンクにしない
   - ただし回答数表示の横に「回答者: 経験者A, ...」のような情報があればリンクにする

3. 回答者登録フロー修正:
   - 回答者として新規登録時に「プロフィールを公開しますか？」のチェックボックスを追加
   - デフォルト: true（新規回答者は公開推奨）
   - 既存ユーザーのデフォルトは false のまま維持（マイグレーションで変更しない）
```

### Phase 2 テスト

```
- [ ] 相談詳細の回答者名をクリックすると /users/:nickname に遷移する
- [ ] 回答者アバターもクリック可能
- [ ] 相談者のニックネームはリンクにならない
- [ ] 新規回答者登録時にプロフィール公開チェックが表示される
```

---

## Phase 3: 運営経由の回答者紹介を全回答者に拡張

### 3-1. DB変更

```
Cursorプロンプト:

contact_requests テーブルを作成（または既存を修正）してください。

★ CRITICAL: target は公認再生プロだけでなく、全ての回答者（advisor/both）が対象

-- テーブル作成
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) NOT NULL,  -- ★ target_pro_user_id ではない
  subject VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  status contact_request_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  forwarded_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ENUMが未作成なら:
DO $$ BEGIN
  CREATE TYPE contact_request_status AS ENUM ('pending','forwarded','responded','closed','rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- RLS: target は advisor/both ロールであること（公認プロ限定ではない）
CREATE POLICY "Target must be advisor role"
  ON contact_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_user_id
    AND auth.uid() != target_user_id  -- 自分自身へは送れない
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = target_user_id
      AND profiles.role IN ('advisor', 'both', 'admin')
    )
  );

CREATE POLICY "Users can read own requests"
  ON contact_requests FOR SELECT
  USING (auth.uid() = requester_user_id);

CREATE POLICY "Target can read forwarded requests"
  ON contact_requests FOR SELECT
  USING (
    auth.uid() = target_user_id
    AND status IN ('forwarded', 'responded', 'closed')
  );

CREATE POLICY "Admins can manage all requests"
  ON contact_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

CREATE INDEX idx_contact_requests_requester ON contact_requests(requester_user_id, created_at DESC);
CREATE INDEX idx_contact_requests_target ON contact_requests(target_user_id, status);
```

### 3-2. API

```
Cursorプロンプト:

POST /api/contact-requests を実装してください。

ファイル: src/app/api/contact-requests/route.ts

リクエスト:
{
  "target_user_id": "uuid",
  "subject": "事業再生についてご相談",    // 100文字以内
  "message": "はじめまして..."            // 2000文字以内
}

処理:
1. 認証チェック（ログイン必須）
2. target_user_id が advisor/both/admin ロールか確認（公認プロ限定ではない！）
3. 自分自身へのリクエストを拒否
4. contact_requests に INSERT
5. master@jugyoin.jp にメール送信（Resend経由）:
   件名: 【もりみち】相談リクエスト — {requester_nickname} → {target_nickname}
   本文:
     ■ 依頼者: {requester_nickname}（{requester_email}）
     ■ 宛先回答者: {target_nickname}
       （公認プロの場合は「宛先プロ: {nickname}（{specialty}）」に分岐）
     ■ 件名: {subject}
     ■ 内容: {message}
     ■ 管理画面: https://morimichi.cc/admin/contact-requests/{id}

レスポンス: { "id": "uuid", "message": "相談リクエストを送信しました。運営が確認の上、おつなぎいたします。" }
```

### 3-3. UIボタン配置

```
Cursorプロンプト:

「運営を通じてこの人に相談する」ボタンを以下の3箇所に配置してください。

1. 相談詳細ページの各回答（depth=1の返信）:
   回答者名の横に小さなリンク: [運営を通じてこの人に相談する]
   ※ advisor/both ロールの回答にのみ表示
   ※ 未ログイン時はログイン誘導
   ※ 自分自身の回答には表示しない

2. /users/:nickname（回答者の公開プロフィールページ）:
   プロフィール情報の下にボタン: [運営を通じてこの人に相談する]

3. クリック時にモーダル表示:
   ┌─────────────────────────────────────┐
   │  運営を通じて {nickname} に相談する    │
   │                                      │
   │  ⚠️ 運営が内容を確認の上、           │
   │  相手の方におつなぎいたします。        │
   │  直接の連絡先交換は行いません。        │
   │                                      │
   │  件名 *                              │
   │  ┌────────────────────────┐          │
   │  │                        │          │
   │  └────────────────────────┘          │
   │                                      │
   │  相談内容 *                          │
   │  ┌────────────────────────┐          │
   │  │                        │          │
   │  │     (2000文字以内)      │          │
   │  │                        │          │
   │  └────────────────────────┘          │
   │                                      │
   │  [キャンセル]  [送信する]             │
   └─────────────────────────────────────┘

送信後: トースト「相談リクエストを送信しました」
```

### Phase 3 テスト

```
- [ ] 相談者が一般回答者（非プロ）に紹介リクエストを送信 → 成功、master@jugyoin.jp にメール
- [ ] 相談者が公認再生プロに紹介リクエストを送信 → 成功
- [ ] 相談者が別の相談者に紹介リクエストを送信 → RLS で拒否
- [ ] 未ログインユーザーが送信 → 401
- [ ] 自分自身に送信 → バリデーションで拒否
- [ ] 相談詳細ページの回答者名横にボタンが表示される（advisor/both のみ）
```

---

## Phase 4: DM防止策（3段階）

```
Cursorプロンプト:

3段階のDM防止策を実装してください。

====== 第1段階: ユーザー教育（UI） ======

1. 相談投稿フォーム・返信フォームの上部に警告文を表示:

   ⚠️ 個人を特定できる情報（メールアドレス、電話番号、
   SNSアカウント等）の記載は禁止されています。

====== 第2段階: クライアント側バリデーション ======

2. src/lib/utils/content-filter.ts を作成:

const CONTACT_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,         // メールアドレス
  /0\d{1,4}-?\d{1,4}-?\d{3,4}/g,                               // 電話番号（日本）
  /\+81\d{9,10}/g,                                              // 国際電話番号
  /LINE\s*(?:ID|id|Id)\s*[:：]?\s*\S+/gi,                       // LINE ID
  /(?:ライン|らいん)\s*(?:ID|id|Id)\s*[:：]?\s*\S+/gi,          // LINE ID（日本語）
  /(?:twitter|instagram|facebook|tiktok)\.com\/\S+/gi,          // SNS URL
  /@[a-zA-Z0-9_]{3,}(?=\s|$)/g,                                // @username
]

export function detectContactInfo(text: string): {
  hasContactInfo: boolean
  matches: string[]
}

3. 検出時:
   - フォーム送信をブロック
   - 警告表示: 「連絡先情報が含まれている可能性があります。内容を修正してから再度お試しください。」
   - ユーザーは修正後に再送信可能

====== 第3段階: サーバー側フラグ + 管理者通知 ======

4. サーバー側でも同じパターンチェック:
   - 検出されても投稿は保存する（過剰ブロック防止）
   - ただし reports テーブルに自動通報レコードを INSERT
     （reason: 'auto_detected_contact_info', details に検出パターン記録）
   - master@jugyoin.jp に自動通報メール:
     件名: 【もりみち】連絡先情報検出 — 自動フラグ
     本文: 投稿ID、投稿者ニックネーム、検出パターン
```

### Phase 4 テスト

```
- [ ] 返信に test@example.com を含めて投稿 → クライアント警告
- [ ] 返信に 090-1234-5678 を含めて投稿 → クライアント警告
- [ ] 「LINE ID: myid123」を含めて投稿 → クライアント警告
- [ ] 「メールアドレスは」のような文脈のみ → 誤検知しない
- [ ] API直接叩きで連絡先含む投稿 → 保存されるが自動通報作成
```

---

## Phase 5: 公認再生プロ（申請・審査・バッジ・一覧）

### 5-1. DB マイグレーション

```
Cursorプロンプト:

以下のSQLを実行してください。

-- ======== ENUMs ========
DO $$ BEGIN
  CREATE TYPE pro_specialty AS ENUM (
    'restructuring', 'lawyer', 'accountant', 'sponsor', 'fund', 'other_expert'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pro_application_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE article_status AS ENUM ('draft', 'published', 'hidden', 'deleted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ======== profiles に公認プロカラム追加 ========
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_certified_pro BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_specialty pro_specialty;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_certified_at TIMESTAMPTZ;

-- ======== 公認再生プロ申請テーブル ========
CREATE TABLE IF NOT EXISTS public.pro_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  specialty pro_specialty NOT NULL,
  application_text TEXT NOT NULL,
  status pro_application_status NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_applications_active
  ON pro_applications(user_id) WHERE status IN ('pending', 'approved');

-- ======== 専門分野マスタ ========
CREATE TABLE IF NOT EXISTS public.pro_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  icon VARCHAR,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO pro_specialties (slug, name, icon, description, sort_order) VALUES
  ('restructuring', '事業再生', '🔄', '事業再建・ターンアラウンドの実務経験者', 1),
  ('lawyer', '弁護士', '⚖️', '倒産法・民事再生・破産に詳しい弁護士', 2),
  ('accountant', '会計士', '📊', '財務・税務・監査の専門家', 3),
  ('sponsor', 'スポンサー', '🤝', '事業承継・M&A・出資の意思ある企業/個人', 4),
  ('fund', 'ファンド', '💼', '再生ファンド・VC・事業投資ファンド', 5),
  ('other_expert', 'その他専門家', '🎯', '社労士、中小企業診断士、不動産鑑定士等', 6)
ON CONFLICT (slug) DO NOTHING;

-- ======== RLS ========
ALTER TABLE pro_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own applications"
  ON pro_applications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all applications"
  ON pro_applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('admin', 'moderator')));

CREATE POLICY "Advisors can create applications"
  ON pro_applications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('advisor', 'both', 'admin'))
  );

CREATE POLICY "Admins can update applications"
  ON pro_applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE pro_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read specialties" ON pro_specialties FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_profiles_certified_pro
  ON profiles(is_certified_pro, pro_specialty) WHERE is_certified_pro = true;
```

### 5-2. 公認プロ API

```
Cursorプロンプト:

以下のAPIエンドポイントを実装してください。

===== POST /api/pro/apply — 申請 =====
ファイル: src/app/api/pro/apply/route.ts
- body: { specialty: pro_specialty, application_text: string(10-1000文字) }
- role が advisor/both/admin のユーザーのみ
- 既に pending/approved の申請がないこと
- pro_applications に INSERT
- master@jugyoin.jp にメール:
  件名: 【もりみち】公認再生プロ申請 — {nickname}（{specialty_name}）
  本文: ニックネーム、メールアドレス、専門分野、申請内容、管理画面URL

===== GET /api/pro/application — 自分の申請状況 =====
ファイル: src/app/api/pro/application/route.ts

===== DELETE /api/pro/application — 申請取り下げ =====
- pending のもののみ取り下げ可能（status を 'withdrawn' に更新）

===== GET /api/pro/members — 公認プロ一覧 =====
ファイル: src/app/api/pro/members/route.ts
- クエリ: ?specialty=lawyer&keyword=破産&sort=replies|reactions|newest&page=1&limit=20
- profiles JOIN pro_specialties でデータ取得
- 認証不要

===== GET /api/pro/specialties — 専門分野マスタ =====
ファイル: src/app/api/pro/specialties/route.ts

===== PATCH /api/admin/pro/applications/:id — 承認/却下 =====
ファイル: src/app/api/admin/pro/applications/[id]/route.ts
- body: { action: "approve"|"reject", reviewer_note?: string }
- approve時:
  1. pro_applications.status = 'approved'
  2. profiles: is_certified_pro=true, pro_specialty=申請specialty, pro_certified_at=now()
  3. 申請者にメール: 件名「公認再生プロに認定されました」
- reject時:
  1. pro_applications.status = 'rejected'
  2. 申請者にメール: 件名「公認再生プロ申請について」

===== GET /api/admin/pro/applications — 全申請一覧（管理者用） =====
```

### 5-3. UIコンポーネント

```
Cursorプロンプト:

以下のコンポーネント・ページを作成してください。

1. src/components/pro/certified-pro-badge.tsx — 黄金バッジ
   - 金色グラデーション背景: bg-gradient-to-r from-amber-400 to-yellow-500
   - 表示: 🏆 公認再生プロ
   - size: 'sm'（一覧・回答者名横）, 'lg'（プロフィール）
   - 専門タグも隣に表示: [🔄 事業再生]

2. マイページに「公認再生プロ」セクション追加:
   - 未申請: 申請ボタン表示
   - 申請中: ステータス表示 + 取り下げボタン
   - 認定済み: バッジ + [コラムを書く] [自分のコラム一覧] ボタン

3. /pro/members — 公認再生プロ一覧ページ
   ファイル: src/app/(public)/pro/members/page.tsx
   - 専門分野フィルタ（タブまたはセレクト）
   - カード形式で表示: avatar, nickname, specialty, headline, stats
   - 各カードに「運営を通じてこの人に相談する」ボタン

4. src/components/pro/pro-member-card.tsx — プロメンバーカード

5. ヘッダーに「プロ一覧」メニュー追加
   モバイル: ボトムナビ or ハンバーガー内に追加

6. 相談詳細・相談一覧で回答者名横にバッジ表示:
   is_certified_pro = true の回答者のニックネーム横に CertifiedProBadge size="sm" を表示
```

### Phase 5 テスト

```
- [ ] advisor ロールのユーザーがマイページから公認プロ申請できる
- [ ] consulter ロールのユーザーには申請ボタンが表示されない
- [ ] 申請後、master@jugyoin.jp にメールが届く
- [ ] 管理者が申請を承認すると is_certified_pro = true になる
- [ ] 承認後、マイページに黄金バッジが表示される
- [ ] /pro/members に認定済みプロが一覧表示される
- [ ] 相談詳細ページの回答者名横にバッジが表示される
```

---

## Phase 6: コラム記事（Tiptapエディタ・画像・SNS共有）

### 6-1. DB マイグレーション

```
Cursorプロンプト:

-- ======== コラム記事テーブル ========
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,                    -- HTML（Tiptap出力）
  summary VARCHAR(200),
  cover_image_url TEXT,
  tags TEXT[],
  status article_status NOT NULL DEFAULT 'draft',
  view_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.article_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES auth.users(id),
  ip_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, ip_hash)
);

-- RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published articles" ON articles FOR SELECT USING (status = 'published');
CREATE POLICY "Authors can read own articles" ON articles FOR SELECT USING (auth.uid() = author_user_id);
CREATE POLICY "Admins can read all articles" ON articles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('admin', 'moderator')));
CREATE POLICY "Certified pros can create articles" ON articles FOR INSERT
  WITH CHECK (auth.uid() = author_user_id AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_certified_pro = true));
CREATE POLICY "Authors can update own articles" ON articles FOR UPDATE USING (auth.uid() = author_user_id);
CREATE POLICY "Admins can update all articles" ON articles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert article views" ON article_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read article views" ON article_views FOR SELECT USING (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_user_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(status, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_tags ON articles USING GIN(tags);

-- ======== article-images Storage バケット ========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('article-images', 'article-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Certified pros can upload article images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'article-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_certified_pro = true)
  );

CREATE POLICY "Public article image access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'article-images');

CREATE POLICY "Users can delete own article images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'article-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 6-2. Tiptap エディタ導入

```
Cursorプロンプト:

1. パッケージインストール:
   pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-heading @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-character-count

2. src/components/articles/article-editor.tsx を作成:

   Note（note.com）に近い WYSIWYG エディタを実装してください。

   レイアウト:
   ┌──────────────────────────────────────────────┐
   │  コラムを書く                                  │
   ├──────────────────────────────────────────────┤
   │  タイトル（100文字以下）                       │
   │  ┌──────────────────────────────────┐        │
   │  │                                    │        │
   │  └──────────────────────────────────┘        │
   │                                                │
   │  カバー画像                                    │
   │  [📷 カバー画像を追加]                         │
   │                                                │
   │  ┌──────────────────────────────────┐        │
   │  │ [H1][H2][H3][H4][H5] [B][I] [🔗] │        │
   │  │ [📷画像] [—引用] [•リスト] [1.番号] │        │
   │  ├──────────────────────────────────┤        │
   │  │                                    │        │
   │  │  ここに本文を書いてください...      │        │
   │  │  （Tiptap WYSIWYG エディタ）       │        │
   │  │                                    │        │
   │  └──────────────────────────────────┘        │
   │  0 / 10,000文字                                │
   │                                                │
   │  概要文（一覧用、200文字以下、任意）            │
   │  ┌──────────────────────────────────┐        │
   │  │                                    │        │
   │  └──────────────────────────────────┘        │
   │                                                │
   │  タグ（最大5つ）                               │
   │  [資金繰り ✕] [銀行交渉 ✕] [+ タグを追加]     │
   │                                                │
   │  [下書き保存]                  [公開する]       │
   └──────────────────────────────────────────────┘

3. エディタの出力はHTML（Tiptapのデフォルト）。
   APIの articles.body カラムにはHTMLを保存。

4. 画像挿入:
   - ツールバーの画像ボタン → ファイル選択ダイアログ
   - クライアントで最大幅 800px にリサイズ、WebP変換
   - POST /api/articles/images でアップロード
   - パス: article-images/{user_id}/{uuid}.webp
   - レスポンスの URL をエディタに挿入
   - ドラッグ&ドロップにも対応
```

### 6-3. コラム API

```
Cursorプロンプト:

以下のAPIを実装してください。

GET    /api/articles          — 公開記事一覧（新着順、ページネーション、タグフィルタ対応）
GET    /api/articles/:id      — 記事詳細
POST   /api/articles          — 記事作成（公認プロのみ）
PATCH  /api/articles/:id      — 記事編集（著者のみ）
DELETE /api/articles/:id      — 記事削除（著者 or 管理者）
POST   /api/articles/:id/view — 閲覧カウント（ip_hash で重複排除）
POST   /api/articles/images   — 記事内画像アップロード
GET    /api/my/articles       — 自分の記事一覧（下書き含む、公認プロのみ）

バリデーション:
- title: 1-100文字
- body: 1-10000文字（HTML）
- summary: 0-200文字
- tags: 0-5個、各1-20文字
- status が published の場合は published_at を現在時刻に設定
- body はサーバー側で DOMPurify によるサニタイズ（Phase 9 参照）
```

### 6-4. コラムページ

```
Cursorプロンプト:

以下のページを作成してください。

1. /articles — コラム一覧ページ
   ファイル: src/app/(public)/articles/page.tsx
   - ArticleCard コンポーネント: カバー画像、タイトル、summary、著者(avatar+nickname+badge)、公開日、閲覧数、タグ
   - タグフィルタ
   - ページネーション

2. /articles/:id — コラム詳細ページ
   ファイル: src/app/(public)/articles/[id]/page.tsx
   - 著者情報（avatar, nickname, badge, specialty）
   - 本文（dangerouslySetInnerHTML + DOMPurify サニタイズ）
   - 閲覧数（POST /api/articles/:id/view を useEffect で呼ぶ）
   - SNS共有ボタン:

     ─────── 共有する ───────
     [𝕏 ポスト]  [LINE で送る]  [Facebook]  [🔗 リンクをコピー]

     // Twitter/X
     `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
     // LINE
     `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`
     // Facebook
     `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
     // リンクコピー
     navigator.clipboard.writeText(url) → トースト「リンクをコピーしました」

3. OGP メタタグ（記事詳細ページの generateMetadata）:
   export async function generateMetadata({ params }): Promise<Metadata> {
     const article = await getArticle(params.id)
     return {
       title: `${article.title} | もりみち`,
       description: article.summary || stripHtml(article.body).slice(0, 120),
       openGraph: {
         title: article.title,
         description: article.summary || stripHtml(article.body).slice(0, 120),
         url: `https://morimichi.cc/articles/${article.id}`,
         siteName: 'もりみち',
         type: 'article',
         publishedTime: article.published_at,
         authors: [article.author.nickname],
         images: article.cover_image_url
           ? [{ url: article.cover_image_url, width: 1200, height: 630 }]
           : [{ url: 'https://morimichi.cc/og-default.png', width: 1200, height: 630 }],
       },
       twitter: { card: 'summary_large_image' },
     }
   }

4. デフォルトOG画像:
   もりみちのロゴ + 「公認再生プロのコラム」テキスト、1200x630px
   → public/og-default.png に配置

5. ヘッダーに「プロのコラム」メニュー追加
```

### Phase 6 テスト

```
- [ ] 公認プロがマイページからコラムエディタを開ける
- [ ] Tiptapで見出し（H1-H5）、太字、リンク、引用、リスト、画像が使える
- [ ] 画像アップロードが動作する（ドラッグ&ドロップ含む）
- [ ] 下書き保存と公開が正しく動作する
- [ ] /articles にコラム一覧が表示される
- [ ] /articles/:id で記事詳細が表示される
- [ ] SNS共有ボタンが正しいURLを生成する
- [ ] OGP メタタグが正しく出力される
- [ ] 非公認プロユーザーはコラム作成できない
```

---

## Phase 7: リアクション仕様確定・depth制限強化

```
Cursorプロンプト:

以下の仕様を明確にして実装してください。

===== リアクション（共感）の仕様 =====

1. 共感の範囲:
   - 全ユーザーが、すべての相談・返信に共感できる（自分の相談内に限らない）
   - ★ 自分自身の投稿には共感できない

2. DB制約追加（自己共感防止）:
   CREATE POLICY "Users cannot self-react"
     ON reactions FOR INSERT
     WITH CHECK (
       auth.uid() != (
         CASE
           WHEN target_type = 'consultation' THEN
             (SELECT user_id FROM consultations WHERE id = target_id)
           WHEN target_type = 'reply' THEN
             (SELECT user_id FROM replies WHERE id = target_id)
         END
       )
     );

3. 共感ボタンのUI統一:
   - 共感済み: ❤️ 128（赤色、クリックで取り消し）
   - 未共感: 🤍 127（グレー、クリックで共感）
   - 自分の投稿: ボタン非表示 or disabled
   - カウントの増減は楽観的更新（即時UI反映 → API呼び出し → 失敗時にロールバック）

===== depth=2 制限の強化 =====

4. DB制約:
   ALTER TABLE replies ADD CONSTRAINT check_reply_depth CHECK (depth <= 2);

5. API側バリデーション:
   POST /api/consultations/:id/replies で:
   if (parentReply && parentReply.depth >= 2) {
     return NextResponse.json(
       { error: 'これ以上返信のネストはできません' },
       { status: 400 }
     )
   }

6. UI: depth=2 の返信には「返信する」ボタンを表示しない
```

### Phase 7 テスト

```
- [ ] 他人の投稿に共感できる
- [ ] 自分の投稿に共感ボタンが表示されない or disabled
- [ ] 共感 → 取り消し → 再共感でカウントが 1→0→1
- [ ] depth=2 の返信に「返信する」ボタンが出ない
- [ ] APIで depth=2 の返信に対して返信POST → 400エラー
```

---

## Phase 8: メール送信の全ポイント実装・QA

### 8-1. メール基盤確認

```
Cursorプロンプト:

まず以下の3点を確認してください。

1. package.json に "resend" が含まれているか → 無ければ pnpm add resend
2. src/lib/email/resend.ts が存在するか → 無ければ作成:

   import { Resend } from 'resend'
   let resendClient: Resend | null = null
   export function getResend(): Resend {
     if (!resendClient) {
       const apiKey = process.env.RESEND_API_KEY
       if (!apiKey) throw new Error('RESEND_API_KEY is not set')
       resendClient = new Resend(apiKey)
     }
     return resendClient
   }

3. 環境変数 RESEND_API_KEY が設定されているか
```

### 8-2. 共通送信関数

```
Cursorプロンプト:

src/lib/email/send.ts を作成してください。

import { getResend } from './resend'

const FROM_ADDRESS = 'もりみち <noreply@morimichi.cc>'
export const ADMIN_ADDRESS = 'master@jugyoin.jp'

export async function sendEmail({ to, subject, html }: {
  to: string; subject: string; html: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend()
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    })
    if (error) {
      console.error('[Email Error]', { to, subject, error })
      return { success: false, error: error.message }
    }
    console.log('[Email Sent]', { to, subject })
    return { success: true }
  } catch (err) {
    console.error('[Email Exception]', { to, subject, err })
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

### 8-3. 全メールポイント実装チェック

```
Cursorプロンプト:

以下の全17メール送信ポイントについて、1つずつ実装状況を確認し、
❌のものをすべて実装してください。

メール送信は fire-and-forget パターン（await sendEmail(...) の結果で
API レスポンスを変えない。メール失敗でも本体処理は成功させる）。

===== カテゴリA: 認証系（Supabase Auth管理）=====
A-1: 新規会員登録時の確認メール → Supabase Auth が送信。テンプレートを Supabase ダッシュボードで日本語にカスタマイズしているか確認。
A-2: 認証メール再送 → 同上
A-3: パスワードリセット → 同上

===== カテゴリB: 双方向通知メール =====
B-1: 相談に回答がついた → POST /api/consultations/:id/replies 内で sendEmail
B-2: 回答に返信がついた → 同上（parent_reply_id がある場合は元の回答者に通知）
B-3: 返信に返信がついた → 同上（depth=2の場合は元の返信者に通知）
B-4: 投稿に共感がついた → POST /api/reactions 内で sendEmail（notification_on_reaction=true のユーザーのみ）

テンプレートファイル: src/lib/email/templates/reply-notification.ts, reaction-notification.ts

===== カテゴリC: 運営通知メール → master@jugyoin.jp =====
C-1: 通報が送信された → POST /api/reports 内で sendEmail
C-2: 公認再生プロ申請 → POST /api/pro/apply 内で sendEmail
C-3: 相談リクエスト受信 → POST /api/contact-requests 内で sendEmail

テンプレートファイル: report-submitted.ts, pro-application.ts, contact-request.ts

===== カテゴリD: 管理アクション通知 =====
D-1: 通報対応完了 → PATCH /api/admin/reports/:id 内で sendEmail
D-2: アカウント警告 → PATCH /api/admin/users/:id/warn 内で sendEmail
D-3: 公認プロ申請承認 → PATCH /api/admin/pro/applications/:id (approve) 内で sendEmail
D-4: 公認プロ申請却下 → 同上 (reject) 内で sendEmail
D-5: 相談リクエスト転送 → PATCH /api/admin/contact-requests/:id (forward) 内で sendEmail
D-6: プロが相談リクエスト回答 → POST /api/pro/contact-requests/:id/respond 内で sendEmail

テンプレートファイル: report-resolved.ts, account-warning.ts, pro-approved.ts, pro-rejected.ts, contact-forwarded.ts, contact-responded.ts

===== カテゴリE: システム通知 =====
E-1: ウェルカムメール → Supabase Auth の confirm webhook または auth.onAuthStateChange でトリガー
E-2: 退会完了 → DELETE /api/users/me 内で sendEmail

テンプレートファイル: welcome.ts, withdrawal.ts

全テンプレートは src/lib/email/templates/ に配置してください。
各テンプレートは件名とHTML本文を返す関数としてエクスポート。
HTML本文のユーザー入力部分には必ず escapeHtml() を適用すること。
```

### Phase 8 テスト

```
- [ ] 新規ユーザー登録 → 確認メールが届く（Supabase Authテンプレートが日本語）
- [ ] 相談に回答 → 相談者にメール通知
- [ ] 通報送信 → master@jugyoin.jp にメール
- [ ] 公認プロ申請 → master@jugyoin.jp にメール
- [ ] 相談リクエスト送信 → master@jugyoin.jp にメール
- [ ] 公認プロ申請承認 → 申請者にメール
- [ ] Resendダッシュボードで送信ログを確認（全メールが記録されている）
```

---

## Phase 9: HTMLサニタイズ設定

```
Cursorプロンプト:

1. pnpm add dompurify @types/dompurify

2. src/lib/utils/sanitize-html.ts を作成:

import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5',
  'p', 'br', 'hr',
  'strong', 'em', 'u', 's',
  'blockquote',
  'ul', 'ol', 'li',
  'a', 'img',
  'pre', 'code',
]

const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height',
  'class',
]

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
  })
}

3. 記事保存時（POST/PATCH /api/articles）のサーバー側で sanitizeArticleHtml(body) を適用
4. 記事表示時（/articles/:id）のクライアント側でも dangerouslySetInnerHTML の前に sanitizeArticleHtml() を適用
```

---

## Phase 10: 相談一覧キーワード検索

```
Cursorプロンプト:

1. DB修正 — 全文検索用カラムとインデックス:
   ALTER TABLE consultations
     ADD COLUMN IF NOT EXISTS title_body_search tsvector
     GENERATED ALWAYS AS (
       to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
     ) STORED;

   CREATE INDEX IF NOT EXISTS idx_consultations_search ON consultations USING GIN(title_body_search);

2. 相談一覧ページ（/consultations）にキーワード検索バーを追加:
   フェーズタブの上に:
   ┌──────────────────────────────────────┐
   │ 🔍 キーワードで相談を検索...           │
   └──────────────────────────────────────┘

3. GET /api/consultations にクエリパラメータ追加:
   ?keyword=資金繰り

   Supabase クエリ:
   keyword がある場合: .textSearch('title_body_search', keyword, { type: 'websearch' })

4. 検索結果でマッチした部分をハイライト表示（任意: ts_headline は重い場合スキップ可）
5. 入力はデバウンス（300ms）してからAPI呼び出し
```

---

## Phase 11: CSS transition修正・UI安定化

```
Cursorプロンプト:

morimichi.cc で「怪しい動き」が報告されています。以下を修正してください。

1. ★最重要: transition: all の削除
   サイト全体に transition: all が適用されており、<html>, <head>, <meta> など
   全要素にトランジションがかかっている。これが原因でページ遷移時やモーダル開閉時に
   不自然なアニメーションが発生しています。

   修正:
   - globals.css で `*, *::before, *::after { transition: all ... }` のようなルールを検索・削除
   - transition が必要な箇所のみ個別に指定:
     .btn { transition: background-color 0.15s ease; }
     .modal-overlay { transition: opacity 0.2s ease; }
   - ★ transition: all は絶対に使わない

2. Next.js Link コンポーネントの正しい使用:
   - <a> タグで直接ナビゲーションしている箇所を next/link の <Link> に変更
   - prefetch は Link のデフォルト動作に任せる

3. ページ遷移時のローディング状態:
   - loading.tsx を各ルートに配置
   - Skeleton UI でコンテンツのプレースホルダーを表示

4. モーダル制御の統一:
   - shadcn/ui の Dialog を使用
   - ESCキーで閉じる
   - オーバーレイクリックで閉じる
   - body スクロールロック

5. フォーム送信中の二重送信防止:
   - ボタンを disabled にする
   - ローディングスピナーを表示
```

### Phase 11 テスト

```
- [ ] ページ遷移時に不自然なアニメーションが発生しない
- [ ] DevTools で <html> 要素に transition プロパティがないことを確認
- [ ] モーダルがスムーズに開閉する
- [ ] ページ遷移中にローディング状態が表示される
- [ ] フォーム送信中にボタンがdisabledになる
```

---

## 完了後の最終チェック

```
Cursorプロンプト:

全 Phase が完了したら、以下の統合テストを実施してください。

1. 新規ユーザー登録（相談者）→ 相談投稿 → 回答者が回答 → 共感ボタン
2. 回答者登録 → プロフィール設定 → アバターアップロード → 公開プロフィール確認
3. 回答者がプロ申請 → master@jugyoin.jp にメール → 管理者が承認 → バッジ表示
4. 公認プロがコラム投稿（Tiptap + 画像） → /articles に表示 → SNS共有
5. 相談者が回答者名をクリック → プロフィール閲覧 → 「運営を通じて相談」リクエスト送信
6. 連絡先情報を含む投稿 → クライアント警告 → サーバーフラグ
7. キーワード検索で相談を見つける
8. モバイルでの全画面レスポンシブ確認
```

---

*この文書は既存の jigyou_saisei_community_MVP_spec_v3.md（v3.3）、cursor_implementation_guide.md、profile_enhancement_guide.md、certified_pro_guide.md、email_qa_guide.md、qa_testing_guide.md、gap_analysis_and_fixes.md の内容を統合し、未実装機能を実装順にまとめたものです。*

*version: 1.0 | 作成日: 2026年3月29日*
