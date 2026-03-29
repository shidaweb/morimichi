# 公認再生プロ機能 — Cursor 実装指示書

> **この文書の使い方**: Cursor の AI に渡して「公認再生プロ」機能を実装するための指示書です。
> `jigyou_saisei_community_MVP_spec_v3.md`、`cursor_implementation_guide.md`、`profile_enhancement_guide.md` と併せて使用してください。
> 技術スタック: Next.js 15 (App Router) + Cloudflare Workers + Supabase + shadcn/ui + Resend

---

## 1. 機能全体像

「公認再生プロ」は、事業再生の専門知識や経験を持つ回答者に運営が認定を付与する仕組み。認定者には黄金バッジとタグが付き、コラム記事を投稿でき、相談者が運営経由でコンタクトを取れる。

```
┌───────────────────────────────────────────────────────────┐
│                       公認再生プロの世界                      │
│                                                             │
│  ① 申請 ─→ ② 運営審査 ─→ ③ 認定（黄金バッジ）               │
│                                                             │
│  認定後にできること:                                          │
│  ├─ コラム記事の投稿・編集・削除                              │
│  ├─ プロフィールに黄金バッジ + 専門タグ表示                    │
│  ├─ 「公認再生プロ一覧」に掲載                                │
│  └─ 「運営を通じてこの人に相談する」ボタンで相談者とマッチング  │
│                                                             │
│  サイト全体への影響:                                          │
│  ├─ ヘッダーに「公認再生プロのコラム」メニュー追加              │
│  ├─ ヘッダーに「公認再生プロ一覧」メニュー追加                  │
│  ├─ 相談一覧・詳細で回答者に黄金バッジ表示                     │
│  └─ 回答の信頼性が視覚的に向上                                │
└───────────────────────────────────────────────────────────┘
```

---

## 2. 公認再生プロの専門分野（プロタイプ）

| # | 専門分野 | slug | アイコン | 説明 | 想定する人物像 |
|---|---------|------|---------|------|--------------|
| 1 | 事業再生 | restructuring | 🔄 | 事業再建・ターンアラウンドの実務経験者 | 再生コンサルタント、元経営者で再生経験あり |
| 2 | 弁護士 | lawyer | ⚖️ | 倒産法・民事再生・破産に詳しい弁護士 | 弁護士（登録番号は非表示、匿名可） |
| 3 | 会計士 | accountant | 📊 | 財務・税務・監査の専門家 | 公認会計士、税理士 |
| 4 | スポンサー | sponsor | 🤝 | 事業承継・M&A・出資の意思ある企業/個人 | 買収検討者、事業承継先候補 |
| 5 | ファンド | fund | 💼 | 再生ファンド・VC・事業投資ファンド | 再生ファンド運営者、PE関係者 |
| 6 | その他専門家 | other_expert | 🎯 | 上記に当てはまらない専門領域 | 社労士、中小企業診断士、不動産鑑定士等 |

### 設計意図

- **匿名性は維持**: 公認再生プロであっても実名公開は任意。ニックネーム + 専門分野タグで活動できる
- **非弁行為リスク対策**: 弁護士タグがあっても「個人的経験・見解としてお伝えします」チェックは回答時に必須のまま。公認再生プロだからといって法的助言が許可されるわけではない
- **運営審査で品質担保**: 申請は誰でもできるが、認定は運営が内容を確認して手動で行う

---

## 3. データベース設計

### 3-1. ENUM 追加

```sql
-- 公認再生プロの専門分野
CREATE TYPE pro_specialty AS ENUM (
  'restructuring',  -- 事業再生
  'lawyer',         -- 弁護士
  'accountant',     -- 会計士
  'sponsor',        -- スポンサー
  'fund',           -- ファンド
  'other_expert'    -- その他専門家
);

-- 公認再生プロ申請ステータス
CREATE TYPE pro_application_status AS ENUM (
  'pending',    -- 審査待ち
  'approved',   -- 承認
  'rejected',   -- 却下
  'withdrawn'   -- 申請取り下げ
);

-- コラム記事ステータス（content_status を流用してもよいが、明示的に分離）
CREATE TYPE article_status AS ENUM (
  'draft',      -- 下書き
  'published',  -- 公開
  'hidden',     -- 運営による非表示
  'deleted'     -- 削除
);

-- 相談リクエストステータス
CREATE TYPE contact_request_status AS ENUM (
  'pending',       -- 運営受付待ち
  'forwarded',     -- プロに転送済み
  'responded',     -- プロが回答済み
  'closed',        -- クローズ
  'rejected'       -- 運営が却下
);
```

### 3-2. テーブル追加

```sql
-- ============================================================
-- 公認再生プロ申請テーブル
-- ============================================================
CREATE TABLE public.pro_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  specialty pro_specialty NOT NULL,
  application_text TEXT NOT NULL,  -- 最大1000文字
  status pro_application_status NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,               -- 運営の内部メモ
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1ユーザーにつき承認済み申請は1つだけ
-- （再申請は前の pending/rejected を取り下げてから）
CREATE UNIQUE INDEX idx_pro_applications_active
  ON pro_applications(user_id)
  WHERE status IN ('pending', 'approved');

-- ============================================================
-- profiles テーブルへのカラム追加
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN is_certified_pro BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN pro_specialty pro_specialty;

ALTER TABLE public.profiles
  ADD COLUMN pro_certified_at TIMESTAMPTZ;

-- ============================================================
-- コラム記事テーブル
-- ============================================================
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,                    -- マークダウンまたはプレーンテキスト
  summary VARCHAR(200),                  -- 一覧用の概要文
  cover_image_url TEXT,                  -- カバー画像（Supabase Storage）
  tags TEXT[],                           -- 自由タグ（例: ["資金繰り", "銀行交渉"]）
  status article_status NOT NULL DEFAULT 'draft',
  view_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,              -- 公開日時
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- コラム記事の閲覧カウント重複排除
CREATE TABLE public.article_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES auth.users(id),  -- 未ログインは NULL
  ip_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, ip_hash)
);

-- ============================================================
-- 運営を通じた相談リクエスト
-- ============================================================
CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_pro_user_id UUID REFERENCES auth.users(id) NOT NULL,
  subject VARCHAR(100) NOT NULL,          -- 相談の件名
  message TEXT NOT NULL,                  -- 相談内容（最大2000文字）
  status contact_request_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,                        -- 運営の内部メモ
  forwarded_at TIMESTAMPTZ,              -- プロに転送した日時
  responded_at TIMESTAMPTZ,              -- プロが回答した日時
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 専門分野マスタ（表示名・アイコン管理用）
-- ============================================================
CREATE TABLE public.pro_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,          -- 'restructuring', 'lawyer' 等
  name VARCHAR NOT NULL,                 -- '事業再生', '弁護士' 等
  icon VARCHAR,                          -- '🔄', '⚖️' 等
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX idx_articles_author ON articles(author_user_id, status, published_at DESC);
CREATE INDEX idx_articles_published ON articles(status, published_at DESC)
  WHERE status = 'published';
CREATE INDEX idx_articles_tags ON articles USING GIN(tags);
CREATE INDEX idx_article_views_article ON article_views(article_id);
CREATE INDEX idx_contact_requests_requester ON contact_requests(requester_user_id, created_at DESC);
CREATE INDEX idx_contact_requests_target ON contact_requests(target_pro_user_id, status);
CREATE INDEX idx_profiles_certified_pro ON profiles(is_certified_pro, pro_specialty)
  WHERE is_certified_pro = true;
```

### 3-3. RLS ポリシー

```sql
-- ==================
-- pro_applications
-- ==================
ALTER TABLE pro_applications ENABLE ROW LEVEL SECURITY;

-- 自分の申請のみ閲覧可能
CREATE POLICY "Users can read own applications"
  ON pro_applications FOR SELECT
  USING (auth.uid() = user_id);

-- 管理者は全申請を閲覧可能
CREATE POLICY "Admins can read all applications"
  ON pro_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- 回答者/両方ロールのユーザーが申請可能
CREATE POLICY "Advisors can create applications"
  ON pro_applications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('advisor', 'both', 'admin')
    )
  );

-- 管理者のみ申請ステータスを更新可能
CREATE POLICY "Admins can update applications"
  ON pro_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ==================
-- articles（コラム記事）
-- ==================
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 公開記事は誰でも閲覧可能
CREATE POLICY "Anyone can read published articles"
  ON articles FOR SELECT
  USING (status = 'published');

-- 著者は自分の記事（下書き含む）を閲覧可能
CREATE POLICY "Authors can read own articles"
  ON articles FOR SELECT
  USING (auth.uid() = author_user_id);

-- 管理者は全記事を閲覧可能
CREATE POLICY "Admins can read all articles"
  ON articles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- 公認再生プロのみ記事を作成可能
CREATE POLICY "Certified pros can create articles"
  ON articles FOR INSERT
  WITH CHECK (
    auth.uid() = author_user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_certified_pro = true
    )
  );

-- 著者は自分の記事を編集可能
CREATE POLICY "Authors can update own articles"
  ON articles FOR UPDATE
  USING (auth.uid() = author_user_id);

-- 管理者は全記事を編集可能（非表示/削除用）
CREATE POLICY "Admins can update all articles"
  ON articles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ==================
-- article_views
-- ==================
ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert article views"
  ON article_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read article views"
  ON article_views FOR SELECT
  USING (true);

-- ==================
-- contact_requests（相談リクエスト）
-- ==================
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーがリクエスト作成可能
CREATE POLICY "Authenticated users can create contact requests"
  ON contact_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_user_id);

-- 自分が送ったリクエストを閲覧可能
CREATE POLICY "Users can read own requests"
  ON contact_requests FOR SELECT
  USING (auth.uid() = requester_user_id);

-- ターゲットのプロは自分宛のリクエスト（転送済み）を閲覧可能
CREATE POLICY "Target pros can read forwarded requests"
  ON contact_requests FOR SELECT
  USING (
    auth.uid() = target_pro_user_id
    AND status IN ('forwarded', 'responded', 'closed')
  );

-- 管理者は全リクエストを閲覧・更新可能
CREATE POLICY "Admins can manage all requests"
  ON contact_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ==================
-- pro_specialties（マスタ）
-- ==================
ALTER TABLE pro_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read specialties"
  ON pro_specialties FOR SELECT
  USING (true);
```

### 3-4. シードデータ（専門分野マスタ）

```sql
INSERT INTO pro_specialties (slug, name, icon, description, sort_order) VALUES
  ('restructuring', '事業再生', '🔄', '事業再建・ターンアラウンドの実務経験者', 1),
  ('lawyer', '弁護士', '⚖️', '倒産法・民事再生・破産に詳しい弁護士', 2),
  ('accountant', '会計士', '📊', '財務・税務・監査の専門家', 3),
  ('sponsor', 'スポンサー', '🤝', '事業承継・M&A・出資の意思ある企業/個人', 4),
  ('fund', 'ファンド', '💼', '再生ファンド・VC・事業投資ファンド', 5),
  ('other_expert', 'その他専門家', '🎯', '社労士、中小企業診断士、不動産鑑定士等', 6);
```

---

## 4. API エンドポイント設計

### 4-1. 公認再生プロ申請

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | `/api/pro/apply` | 公認再生プロ申請 | 必要（回答者/両方のみ） |
| GET | `/api/pro/application` | 自分の申請状況取得 | 必要 |
| DELETE | `/api/pro/application` | 申請取り下げ | 必要（pending のみ） |

### 4-2. 公認再生プロ一覧・詳細

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/pro/members` | 公認再生プロ一覧（検索・フィルタ対応） | 不要 |
| GET | `/api/pro/members/:nickname` | 公認再生プロ詳細 | 不要 |
| GET | `/api/pro/specialties` | 専門分野マスタ一覧 | 不要 |

### 4-3. コラム記事

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/articles` | コラム記事一覧（公開のみ、新着順） | 不要 |
| GET | `/api/articles/:id` | コラム記事詳細 | 不要 |
| POST | `/api/articles` | コラム記事作成 | 必要（公認再生プロのみ） |
| PATCH | `/api/articles/:id` | コラム記事編集 | 必要（著者のみ） |
| DELETE | `/api/articles/:id` | コラム記事削除 | 必要（著者 or 管理者） |
| POST | `/api/articles/:id/view` | 閲覧カウント記録 | 不要 |
| GET | `/api/my/articles` | 自分の記事一覧（下書き含む） | 必要（公認再生プロのみ） |

### 4-4. 相談リクエスト（運営経由コンタクト）

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | `/api/contact-requests` | 相談リクエスト送信 | 必要 |
| GET | `/api/my/contact-requests` | 自分が送った相談リクエスト一覧 | 必要 |
| GET | `/api/pro/contact-requests` | 自分宛の相談リクエスト一覧（プロ側） | 必要（公認再生プロのみ） |

### 4-5. 管理者用

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/admin/pro/applications` | 全申請一覧 | 必要（管理者のみ） |
| PATCH | `/api/admin/pro/applications/:id` | 申請の承認/却下 | 必要（管理者のみ） |
| GET | `/api/admin/contact-requests` | 全相談リクエスト一覧 | 必要（管理者のみ） |
| PATCH | `/api/admin/contact-requests/:id` | リクエストの転送/クローズ | 必要（管理者のみ） |

---

## 5. API 詳細設計

### 5-1. POST `/api/pro/apply` — 公認再生プロ申請

```typescript
// リクエスト:
{
  "specialty": "restructuring",        // pro_specialty ENUM
  "application_text": "私は2015年から..."  // 最大1000文字
}

// バリデーション:
// - ユーザーの role が advisor / both / admin のいずれか
// - application_text: 10〜1000文字
// - specialty: pro_specialty ENUM の有効値
// - 既に pending または approved の申請が無いこと

// 処理:
// 1. pro_applications に INSERT
// 2. Resend 経由で master@jugyoin.jp にメール送信
// 3. 成功レスポンス返却

// メール送信内容:
// To: master@jugyoin.jp
// Subject: 【もりみち】公認再生プロ申請 — {nickname}（{specialty_name}）
// Body:
//   ■ ニックネーム: {nickname}
//   ■ メールアドレス: {email}
//   ■ 専門分野: {specialty_name}
//   ■ 申請日時: {created_at}
//   ■ 申請内容:
//   {application_text}
//
//   ■ 管理画面:
//   https://morimichi.cc/admin/pro/applications/{application_id}

// レスポンス:
{
  "id": "uuid",
  "status": "pending",
  "message": "公認再生プロ申請を受け付けました。運営からのお返事をお待ちください。"
}
```

### 5-2. PATCH `/api/admin/pro/applications/:id` — 申請の承認/却下

```typescript
// リクエスト:
{
  "action": "approve" | "reject",
  "reviewer_note": "問題なし。経歴確認済み。"  // 任意
}

// 処理（approve の場合）:
// 1. pro_applications.status = 'approved', reviewed_at, reviewed_by を更新
// 2. profiles テーブルを更新:
//    - is_certified_pro = true
//    - pro_specialty = 申請時の specialty
//    - pro_certified_at = now()
// 3. 申請者にメール通知:
//    Subject: 【もりみち】公認再生プロに認定されました
//    Body: おめでとうございます。コラム記事の投稿が可能になりました。

// 処理（reject の場合）:
// 1. pro_applications.status = 'rejected' に更新
// 2. 申請者にメール通知:
//    Subject: 【もりみち】公認再生プロ申請について
//    Body: 申請内容を確認いたしましたが、現時点ではお見送りとなりました。
//          再度申請いただくことも可能です。
```

### 5-3. GET `/api/pro/members` — 公認再生プロ一覧

```typescript
// クエリパラメータ:
{
  "specialty": "lawyer",     // 専門分野フィルタ（任意）
  "keyword": "破産",          // ニックネーム or bio で検索（任意）
  "sort": "replies" | "reactions" | "newest",  // ソート
  "page": 1,
  "limit": 20
}

// レスポンス:
{
  "members": [
    {
      "nickname": "経験者A",
      "avatar_url": "...",
      "headline": "元飲食店経営者。破産から再起した経験があります",
      "bio": "...",
      "pro_specialty": {
        "slug": "restructuring",
        "name": "事業再生",
        "icon": "🔄"
      },
      "experience_phases": ["資金繰り", "破産", "再生"],
      "stats": {
        "total_replies": 42,
        "total_reactions_received": 128,
        "total_articles": 5,
        "total_article_views": 2340
      },
      "pro_certified_at": "2026-02-01T..."
    }
  ],
  "total": 15,
  "page": 1,
  "total_pages": 1
}
```

### 5-4. POST `/api/contact-requests` — 運営経由の相談リクエスト

```typescript
// リクエスト:
{
  "target_pro_nickname": "経験者A",
  "subject": "事業再生の進め方についてご相談",
  "message": "はじめまして。飲食業を経営しており..."  // 最大2000文字
}

// 処理:
// 1. contact_requests に INSERT
// 2. master@jugyoin.jp にメール送信:
//    Subject: 【もりみち】相談リクエスト — {requester_nickname} → {target_nickname}
//    Body:
//      ■ 依頼者: {requester_nickname}（{requester_email}）
//      ■ 宛先プロ: {target_nickname}（{target_specialty_name}）
//      ■ 件名: {subject}
//      ■ 内容:
//      {message}
//
//      ■ 管理画面:
//      https://morimichi.cc/admin/contact-requests/{id}

// レスポンス:
{
  "id": "uuid",
  "message": "相談リクエストを送信しました。運営が確認の上、おつなぎいたします。"
}
```

### 5-5. POST `/api/articles` — コラム記事作成

```typescript
// リクエスト:
{
  "title": "銀行との交渉で大切な3つのこと",       // 最大100文字
  "body": "## はじめに\n\n私は2015年に...",         // マークダウン形式
  "summary": "銀行交渉の経験から得た実践的なコツ",   // 最大200文字、任意
  "tags": ["資金繰り", "銀行交渉"],                // 最大5つ
  "status": "draft" | "published"
}

// バリデーション:
// - ユーザーが公認再生プロであること（is_certified_pro = true）
// - title: 1〜100文字
// - body: 1〜10000文字
// - summary: 0〜200文字
// - tags: 0〜5個、各タグ1〜20文字
// - status が published の場合、published_at を現在時刻に設定

// レスポンス:
{
  "id": "uuid",
  "title": "...",
  "status": "published",
  "published_at": "2026-03-28T..."
}
```

---

## 6. 画面設計

### 6-1. ヘッダーナビ（変更後）

```
┌──────────────────────────────────────────────────────────────┐
│  もりみち    相談一覧  プロのコラム  プロ一覧  支援リンク  ログイン 登録 │
└──────────────────────────────────────────────────────────────┘

モバイル時（ボトムナビ or ハンバーガー内）:
  相談一覧 / プロのコラム / プロ一覧 / 支援リンク
```

### 6-2. マイページ — 公認再生プロ申請セクション

```
（既存のマイページに以下のセクションを追加）

─────── 公認再生プロ ───────

【未申請の場合】
┌───────────────────────────────────────┐
│  🏆 公認再生プロになりませんか？        │
│                                        │
│  事業再生の専門知識や経験をお持ちの方は  │
│  公認再生プロとして活動できます。        │
│  コラム記事の投稿や、相談者との           │
│  マッチングが可能になります。            │
│                                        │
│        [公認再生プロ申請をする]          │
└───────────────────────────────────────┘

【申請ボタン押下後 → 申請フォーム表示】
┌───────────────────────────────────────┐
│  公認再生プロ申請                        │
│                                        │
│  専門分野 *                             │
│  ┌──────────────────────────┐          │
│  │ 事業再生              ▼  │          │
│  └──────────────────────────┘          │
│  ※ 事業再生、弁護士、会計士、            │
│    スポンサー、ファンド、その他専門家      │
│                                        │
│  過去の経験・専門性について *            │
│  ┌──────────────────────────┐          │
│  │                            │          │
│  │ 公認再生プロとして登録する   │          │
│  │ には過去の経験などについて   │          │
│  │ 記述してください            │          │
│  │                            │          │
│  └──────────────────────────┘          │
│  0 / 1000文字                           │
│                                        │
│           [申請を送信する]              │
└───────────────────────────────────────┘

【送信成功後 → 同じ画面内で表示切替】
┌───────────────────────────────────────┐
│  ✅ 公認再生プロ申請を受け付けました。    │
│  運営からのお返事をお待ちください。       │
│                                        │
│  申請日: 2026年3月28日                   │
│  専門分野: 事業再生                      │
│  ステータス: 審査中                      │
│                                        │
│        [申請を取り下げる]               │
└───────────────────────────────────────┘

【認定済みの場合】
┌───────────────────────────────────────┐
│  🏆 公認再生プロ                        │
│  認定日: 2026年2月1日                    │
│  専門分野: 🔄 事業再生                   │
│                                        │
│  [コラムを書く]  [自分のコラム一覧]      │
│  [相談リクエスト確認 (3件)]              │
└───────────────────────────────────────┘
```

### 6-3. 黄金バッジ + 専門タグのデザイン

```
表示パターン（インラインバッジ）:

  [🏆 公認再生プロ] [🔄 事業再生]     ← 黄金背景 + 専門タグ
  [🏆 公認再生プロ] [⚖️ 弁護士]
  [🏆 公認再生プロ] [📊 会計士]

表示箇所:
  - ヘッダー（ログイン後のニックネーム横）: バッジのみ（小）
  - マイページ: バッジ + タグ（大）
  - 公開プロフィール: バッジ + タグ（大）
  - 相談一覧の回答者名横: バッジのみ（小）
  - 相談詳細の回答者名横: バッジ + タグ
  - コラム記事カード: バッジ + タグ
  - 公認再生プロ一覧: バッジ + タグ（大）
```

### 6-4. 公認再生プロのコラム一覧ページ `/articles`

```
┌──────────────────────────────────────────────────────┐
│  もりみち  相談一覧  プロのコラム  プロ一覧  支援リンク  │
├──────────────────────────────────────────────────────┤
│                                                        │
│  公認再生プロのコラム                                   │
│  事業再生の専門家が経験をもとに書いた記事です。           │
│                                                        │
│  ─────── フィルタ ───────                              │
│  専門分野: [すべて▼]  タグ: [資金繰り▼]                 │
│                                                        │
│  ┌────────────────────────────────────────────┐       │
│  │  📷  銀行との交渉で大切な3つのこと           │       │
│  │ avatar                                       │       │
│  │  経験者A  [🏆] [🔄 事業再生]                 │       │
│  │  銀行交渉の経験から得た実践的なコツを          │       │
│  │  3つのポイントに絞ってお伝えします...          │       │
│  │                                               │       │
│  │  👁 234   📅 2026/03/25                       │       │
│  │  #資金繰り #銀行交渉                          │       │
│  └────────────────────────────────────────────┘       │
│                                                        │
│  ┌────────────────────────────────────────────┐       │
│  │  📷  民事再生の実務フローを解説               │       │
│  │ avatar                                       │       │
│  │  法務太郎  [🏆] [⚖️ 弁護士]                  │       │
│  │  民事再生法に基づく手続きの流れを              │       │
│  │  わかりやすく解説します...                     │       │
│  │                                               │       │
│  │  👁 567   📅 2026/03/20                       │       │
│  │  #再生 #民事再生法                            │       │
│  └────────────────────────────────────────────┘       │
│                                                        │
│  [もっと読む]                                           │
│                                                        │
└──────────────────────────────────────────────────────┘
```

### 6-5. コラム記事詳細ページ `/articles/:id`

```
┌──────────────────────────────────────────────────────┐
│  ← コラム一覧に戻る                                    │
├──────────────────────────────────────────────────────┤
│                                                        │
│  銀行との交渉で大切な3つのこと                          │
│                                                        │
│  ┌──────┐  経験者A                                    │
│  │avatar│  [🏆 公認再生プロ] [🔄 事業再生]            │
│  └──────┘  元飲食店経営者。破産から再起した経験あり     │
│            2026/03/25 公開  ・  👁 234                  │
│                                                        │
│  ─────────────────────────────────────                │
│                                                        │
│  ## はじめに                                           │
│                                                        │
│  私は2015年に飲食店を経営していた際、資金繰りが          │
│  行き詰まり銀行との交渉を何度も行いました。              │
│  そこで学んだことを3つのポイントに絞って...              │
│                                                        │
│  ## ポイント1: 早めの相談                               │
│  ...                                                   │
│                                                        │
│  ─────────────────────────────────────                │
│                                                        │
│  #資金繰り  #銀行交渉                                   │
│                                                        │
│  ─────── この著者の他の記事 ───────                    │
│  ▸ 破産手続きの実体験レポート          2026/03/15      │
│  ▸ 再起するために必要だった3つの覚悟    2026/03/01      │
│                                                        │
│  ─────── 著者に相談する ───────                       │
│  ┌────────────────────────────────────────┐           │
│  │  この公認再生プロに運営を通じて           │           │
│  │  相談することができます。                  │           │
│  │                                           │           │
│  │  [運営を通じてこの人に相談する]           │           │
│  └────────────────────────────────────────┘           │
│                                                        │
└──────────────────────────────────────────────────────┘
```

### 6-6. 公認再生プロ一覧ページ `/pro`

```
┌──────────────────────────────────────────────────────┐
│  もりみち  相談一覧  プロのコラム  プロ一覧  支援リンク  │
├──────────────────────────────────────────────────────┤
│                                                        │
│  公認再生プロ一覧                                       │
│  運営が認定した事業再生の専門家・経験者です。            │
│                                                        │
│  ─────── 検索・フィルタ ───────                       │
│  専門分野:                                              │
│  [すべて] [🔄事業再生] [⚖️弁護士] [📊会計士]          │
│  [🤝スポンサー] [💼ファンド] [🎯その他]                │
│                                                        │
│  経験フェーズ: [資金繰り▼]                              │
│  並び替え: [回答が多い順▼]                              │
│                                                        │
│  ─────── 結果: 15名 ───────                           │
│                                                        │
│  ┌────────────────────────────────────────────┐       │
│  │  ┌──────┐  経験者A                          │       │
│  │  │avatar│  [🏆] [🔄 事業再生]               │       │
│  │  └──────┘  元飲食店経営者。再起経験あり       │       │
│  │             東京都 ・ 経験15年                │       │
│  │                                              │       │
│  │  💬 回答 42件  ❤️ 共感 128  📝 コラム 5本    │       │
│  │  経験: [💰資金繰り] [📉破産] [🔄再生]        │       │
│  │                                              │       │
│  │  [プロフィールを見る] [運営を通じて相談する]   │       │
│  └────────────────────────────────────────────┘       │
│                                                        │
│  ┌────────────────────────────────────────────┐       │
│  │  ┌──────┐  法務太郎                          │       │
│  │  │avatar│  [🏆] [⚖️ 弁護士]                 │       │
│  │  └──────┘  倒産法専門の弁護士。民事再生を     │       │
│  │             多数手がけています                 │       │
│  │             大阪府                            │       │
│  │                                              │       │
│  │  💬 回答 78件  ❤️ 共感 245  📝 コラム 12本   │       │
│  │  経験: [🔄再生] [📉破産] [⚖️係争]            │       │
│  │                                              │       │
│  │  [プロフィールを見る] [運営を通じて相談する]   │       │
│  └────────────────────────────────────────────┘       │
│                                                        │
│  [1] [2] [3] [次へ →]                                  │
│                                                        │
└──────────────────────────────────────────────────────┘
```

### 6-7. 相談リクエストフォーム（モーダル）

```
┌──────────────────────────────────────────────────────┐
│  運営を通じて相談する                        [✕ 閉じる]│
├──────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────┐  経験者A                                    │
│  │avatar│  [🏆 公認再生プロ] [🔄 事業再生]            │
│  └──────┘                                              │
│                                                        │
│  ⚠️ この相談は運営（もりみち事務局）を通じて             │
│  お伝えします。直接の連絡先交換は行いません。            │
│                                                        │
│  件名 *                                                │
│  ┌──────────────────────────────────────┐              │
│  │ 事業再生の進め方についてご相談         │              │
│  └──────────────────────────────────────┘              │
│  100文字以下                                           │
│                                                        │
│  ご相談内容 *                                          │
│  ┌──────────────────────────────────────┐              │
│  │                                        │              │
│  │ はじめまして。飲食業を経営して          │              │
│  │ おりますが、資金繰りが厳しく...         │              │
│  │                                        │              │
│  └──────────────────────────────────────┘              │
│  0 / 2000文字                                          │
│                                                        │
│  ※ 運営が内容を確認した上で、公認再生プロに              │
│    お伝えします。回答が届いた場合は                       │
│    メールでお知らせいたします。                           │
│                                                        │
│              [相談リクエストを送信する]                  │
└──────────────────────────────────────────────────────┘

【送信後 → 同一モーダル内で切替】
┌──────────────────────────────────────────────────────┐
│                                                        │
│  ✅ 相談リクエストを送信しました。                       │
│                                                        │
│  運営が確認の上、おつなぎいたします。                    │
│  回答が届いた場合はメールでお知らせします。               │
│                                                        │
│                    [閉じる]                             │
└──────────────────────────────────────────────────────┘
```

### 6-8. コラム執筆画面 `/articles/new`

```
┌──────────────────────────────────────────────────────┐
│  ← マイページに戻る                                    │
├──────────────────────────────────────────────────────┤
│                                                        │
│  コラムを書く                                          │
│                                                        │
│  タイトル *                                            │
│  ┌──────────────────────────────────────┐              │
│  │ 銀行との交渉で大切な3つのこと         │              │
│  └──────────────────────────────────────┘              │
│  100文字以下                                           │
│                                                        │
│  概要文（一覧表示用）                                   │
│  ┌──────────────────────────────────────┐              │
│  │ 銀行交渉の経験から得た実践的なコツ     │              │
│  └──────────────────────────────────────┘              │
│  200文字以下                                           │
│                                                        │
│  本文 *                                                │
│  ┌──────────────────────────────────────┐              │
│  │ ## はじめに                            │              │
│  │                                        │              │
│  │ 私は2015年に飲食店を経営していた際...   │              │
│  │                                        │              │
│  │                                        │              │
│  │                                        │              │
│  └──────────────────────────────────────┘              │
│  マークダウン形式に対応  ・  0 / 10000文字              │
│                                                        │
│  タグ（最大5つ）                                        │
│  [資金繰り ✕] [銀行交渉 ✕] [+ タグを追加]              │
│                                                        │
│  ┌──────────────────────────────────────┐              │
│  │  💡 記事の内容は個人的な経験・見解と     │              │
│  │  してお書きください。法的助言や           │              │
│  │  断定的な表現はお控えください。           │              │
│  └──────────────────────────────────────┘              │
│                                                        │
│  [下書き保存]           [公開する]                      │
│                                                        │
└──────────────────────────────────────────────────────┘
```

---

## 7. コンポーネント設計

### 7-1. 黄金バッジコンポーネント

```typescript
// src/components/ui/certified-pro-badge.tsx

interface CertifiedProBadgeProps {
  specialty?: {
    slug: string
    name: string
    icon: string
  }
  size?: 'sm' | 'md' | 'lg'
  showSpecialty?: boolean
}

const sizeMap = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-0.5',
  lg: 'text-base px-3 py-1',
}

export function CertifiedProBadge({
  specialty,
  size = 'md',
  showSpecialty = true,
}: CertifiedProBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* 黄金バッジ */}
      <span
        className={`inline-flex items-center gap-1 rounded-full font-medium
          bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200
          text-amber-900 border border-amber-400/50
          shadow-sm ${sizeMap[size]}`}
      >
        <span>🏆</span>
        <span>公認再生プロ</span>
      </span>

      {/* 専門タグ */}
      {showSpecialty && specialty && (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-medium
            bg-stone-100 text-stone-700 border border-stone-200
            ${sizeMap[size]}`}
        >
          <span>{specialty.icon}</span>
          <span>{specialty.name}</span>
        </span>
      )}
    </span>
  )
}
```

### 7-2. 記事カードコンポーネント

```typescript
// src/components/articles/article-card.tsx

import Link from 'next/link'
import { UserAvatar } from '@/components/ui/user-avatar'
import { CertifiedProBadge } from '@/components/ui/certified-pro-badge'
import { Eye, Calendar } from 'lucide-react'

interface ArticleCardProps {
  article: {
    id: string
    title: string
    summary: string | null
    tags: string[]
    view_count: number
    published_at: string
    author: {
      nickname: string
      avatar_url: string | null
      pro_specialty: { slug: string; name: string; icon: string }
    }
  }
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="block rounded-lg border border-border p-5 hover:shadow-md
                 transition-shadow duration-200 bg-card"
    >
      <div className="flex items-start gap-3 mb-3">
        <UserAvatar
          avatarUrl={article.author.avatar_url}
          nickname={article.author.nickname}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{article.author.nickname}</span>
            <CertifiedProBadge
              specialty={article.author.pro_specialty}
              size="sm"
            />
          </div>
        </div>
      </div>

      <h3 className="font-bold text-lg mb-2 line-clamp-2">
        {article.title}
      </h3>

      {article.summary && (
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
          {article.summary}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {article.view_count.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(article.published_at).toLocaleDateString('ja-JP')}
          </span>
        </div>

        {article.tags.length > 0 && (
          <div className="flex gap-1.5">
            {article.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
```

### 7-3. プロ一覧カードコンポーネント

```typescript
// src/components/pro/pro-member-card.tsx

import Link from 'next/link'
import { UserAvatar } from '@/components/ui/user-avatar'
import { CertifiedProBadge } from '@/components/ui/certified-pro-badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Heart, FileText } from 'lucide-react'

interface ProMemberCardProps {
  member: {
    nickname: string
    avatar_url: string | null
    headline: string | null
    prefecture: string | null
    years_of_experience: number | null
    pro_specialty: { slug: string; name: string; icon: string }
    experience_phases: string[]
    stats: {
      total_replies: number
      total_reactions_received: number
      total_articles: number
    }
  }
  onContactClick: (nickname: string) => void
}

export function ProMemberCard({ member, onContactClick }: ProMemberCardProps) {
  return (
    <div className="rounded-lg border border-border p-5 bg-card">
      <div className="flex items-start gap-4">
        <UserAvatar
          avatarUrl={member.avatar_url}
          nickname={member.nickname}
          size="xl"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-lg">{member.nickname}</span>
            <CertifiedProBadge
              specialty={member.pro_specialty}
              size="sm"
            />
          </div>
          {member.headline && (
            <p className="text-muted-foreground text-sm mb-1">{member.headline}</p>
          )}
          <p className="text-muted-foreground text-xs">
            {[member.prefecture, member.years_of_experience && `経験${member.years_of_experience}年`]
              .filter(Boolean).join(' ・ ')}
          </p>
        </div>
      </div>

      {/* 統計 */}
      <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-4 w-4" /> 回答 {member.stats.total_replies}件
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-4 w-4" /> 共感 {member.stats.total_reactions_received}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-4 w-4" /> コラム {member.stats.total_articles}本
        </span>
      </div>

      {/* 経験フェーズ */}
      {member.experience_phases.length > 0 && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {member.experience_phases.map(phase => (
            <span
              key={phase}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {phase}
            </span>
          ))}
        </div>
      )}

      {/* アクション */}
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/users/${member.nickname}`}>プロフィールを見る</Link>
        </Button>
        <Button
          size="sm"
          className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
          onClick={() => onContactClick(member.nickname)}
        >
          運営を通じて相談する
        </Button>
      </div>
    </div>
  )
}
```

---

## 8. ディレクトリ構成（追加分）

```
src/
├── app/
│   ├── (public)/
│   │   ├── articles/
│   │   │   ├── page.tsx              # コラム一覧
│   │   │   ├── loading.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # コラム詳細
│   │   │       └── loading.tsx
│   │   └── pro/
│   │       ├── page.tsx              # 公認再生プロ一覧
│   │       ├── loading.tsx
│   │       └── [nickname]/
│   │           ├── page.tsx          # プロ詳細（公開プロフから転用可）
│   │           └── loading.tsx
│   ├── (protected)/
│   │   ├── mypage/
│   │   │   └── page.tsx              # マイページ（申請セクション追加）
│   │   ├── articles/
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # コラム執筆
│   │   │   └── [id]/
│   │   │       └── edit/
│   │   │           └── page.tsx      # コラム編集
│   │   └── contact-requests/
│   │       └── page.tsx              # 自分の相談リクエスト一覧
│   └── api/
│       ├── pro/
│       │   ├── apply/
│       │   │   └── route.ts          # 申請 CRUD
│       │   ├── application/
│       │   │   └── route.ts          # 自分の申請状況
│       │   ├── members/
│       │   │   ├── route.ts          # プロ一覧
│       │   │   └── [nickname]/
│       │   │       └── route.ts      # プロ詳細
│       │   ├── specialties/
│       │   │   └── route.ts          # 専門分野マスタ
│       │   └── contact-requests/
│       │       └── route.ts          # プロ側の相談リクエスト
│       ├── articles/
│       │   ├── route.ts              # 記事一覧・作成
│       │   └── [id]/
│       │       ├── route.ts          # 記事詳細・編集・削除
│       │       └── view/
│       │           └── route.ts      # 閲覧カウント
│       ├── my/
│       │   ├── articles/
│       │   │   └── route.ts          # 自分の記事一覧
│       │   └── contact-requests/
│       │       └── route.ts          # 自分の相談リクエスト
│       └── admin/
│           ├── pro/
│           │   └── applications/
│           │       ├── route.ts      # 申請一覧
│           │       └── [id]/
│           │           └── route.ts  # 承認/却下
│           └── contact-requests/
│               ├── route.ts          # 全リクエスト一覧
│               └── [id]/
│                   └── route.ts      # 転送/クローズ
├── components/
│   ├── ui/
│   │   └── certified-pro-badge.tsx   # 黄金バッジ
│   ├── pro/
│   │   ├── pro-member-card.tsx       # プロ一覧カード
│   │   ├── pro-application-form.tsx  # 申請フォーム
│   │   ├── contact-request-modal.tsx # 相談リクエストモーダル
│   │   └── specialty-filter.tsx      # 専門分野フィルタ
│   └── articles/
│       ├── article-card.tsx          # 記事カード
│       ├── article-editor.tsx        # 記事エディタ
│       └── article-content.tsx       # マークダウンレンダリング
└── lib/
    └── constants/
        └── specialties.ts            # 専門分野定数
```

---

## 9. メール通知設計

### 9-1. 送信されるメール一覧

| トリガー | 宛先 | 件名 | 送信タイミング |
|---------|------|------|-------------|
| 公認再生プロ申請 | master@jugyoin.jp | 【もりみち】公認再生プロ申請 — {nickname}（{specialty}） | 即時 |
| 申請承認 | 申請者 | 【もりみち】公認再生プロに認定されました | 即時 |
| 申請却下 | 申請者 | 【もりみち】公認再生プロ申請について | 即時 |
| 相談リクエスト受信 | master@jugyoin.jp | 【もりみち】相談リクエスト — {from} → {to} | 即時 |
| リクエスト転送 | 対象のプロ | 【もりみち】相談リクエストが届いています | 即時 |
| プロが回答 | リクエスト送信者 | 【もりみち】相談リクエストへの回答が届きました | 即時 |

### 9-2. 申請通知メールのテンプレート

```typescript
// src/lib/email/templates/pro-application.ts

export function proApplicationEmail(data: {
  nickname: string
  email: string
  specialtyName: string
  applicationText: string
  applicationId: string
}) {
  return {
    to: 'master@jugyoin.jp',
    subject: `【もりみち】公認再生プロ申請 — ${data.nickname}（${data.specialtyName}）`,
    html: `
      <h2>公認再生プロ申請</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; width: 120px;">
            <strong>ニックネーム</strong>
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.nickname}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">
            <strong>メールアドレス</strong>
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">
            <strong>専門分野</strong>
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.specialtyName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">
            <strong>申請内容</strong>
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">
            ${data.applicationText}
          </td>
        </tr>
      </table>
      <p style="margin-top: 16px;">
        <a href="https://morimichi.cc/admin/pro/applications/${data.applicationId}"
           style="background: #166534; color: white; padding: 8px 16px;
                  text-decoration: none; border-radius: 4px;">
          管理画面で確認する
        </a>
      </p>
    `,
  }
}
```

---

## 10. セキュリティ・法務考慮事項

| リスク | 対策 |
|--------|------|
| 虚偽の資格申告（弁護士を詐称） | 「公認再生プロは運営が独自に認定するもので、国家資格の証明ではありません」の免責表示。利用規約に記載 |
| 非弁行為（弁護士タグの人が法的助言） | 回答・コラムに「個人的経験・見解です」の注記を自動挿入。断定表現は通報対象 |
| 相談リクエストでの個人情報交換 | 運営が中継するため直接連絡先は伝わらない。リクエスト本文にメアド・電話番号が含まれる場合は運営が除外 |
| コラムに広告・宣伝を書く | 記事に「集客目的の投稿は禁止」ルール。通報→運営が非表示に |
| 公認再生プロの取り消し | 管理者が `profiles.is_certified_pro = false` に戻す。記事は残すが「元公認再生プロ」表示なし |
| スポンサー/ファンドによる囲い込み | 相談リクエストの運営中継により、不適切な勧誘を運営がフィルタリング |
| XSS via コラム記事（マークダウン） | マークダウンレンダラーで HTML タグをサニタイズ（`rehype-sanitize`） |
| レート制限 | 申請: 1回/日、相談リクエスト: 3回/日、記事投稿: 5回/日 |

---

## 11. Cursor 実行プロンプト（フェーズ別）

### Phase 1: DB マイグレーション（1日）

```
Cursorプロンプト:

1. Supabase SQL Editor で以下を順番に実行:
   - Section 3-1 の ENUM 追加（pro_specialty, pro_application_status, article_status, contact_request_status）
   - Section 3-2 のテーブル作成（pro_applications, articles, article_views, contact_requests, pro_specialties + profiles カラム追加）
   - Section 3-3 の RLS ポリシー全て
   - Section 3-4 のシードデータ

2. TypeScript 型定義を再生成:
   supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
```

### Phase 2: 黄金バッジ + 既存画面への反映（2日）

```
Cursorプロンプト:

1. src/components/ui/certified-pro-badge.tsx を作成（Section 7-1）

2. 既存の全コンポーネントで、回答者のニックネーム表示部分を検索し、
   profiles.is_certified_pro === true の場合に CertifiedProBadge を表示する:
   - ヘッダーのユーザー名横
   - 相談一覧の回答カウント横
   - 相談詳細ページの回答者名横
   - 返信コンポーネントの投稿者名横
   - 公開プロフィールページ

3. 表示サイズは Section 6-3 のルールに従う
```

### Phase 3: 公認再生プロ申請フロー（2日）

```
Cursorプロンプト:

1. src/components/pro/pro-application-form.tsx を作成:
   - 専門分野セレクト（6種類）
   - テキストエリア（最大1000文字、文字数カウント表示）
   - 送信ボタン（ダブルサブミット防止）
   - 送信成功後は同一画面内で「受け付けました」表示に切替
   - 申請済みの場合はステータス表示 + 取り下げボタン
   - 認定済みの場合は Section 6-2 の認定済み表示

2. マイページ（src/app/(protected)/mypage/page.tsx）に
   「公認再生プロ」セクションを追加。
   ロールが advisor / both の場合のみ表示。

3. src/app/api/pro/apply/route.ts を作成:
   - POST: バリデーション → INSERT → メール送信 → レスポンス
   - Resend で master@jugyoin.jp にメール送信（Section 9-2 テンプレート使用）

4. src/app/api/pro/application/route.ts を作成:
   - GET: 自分の申請状況取得
   - DELETE: pending の申請取り下げ
```

### Phase 4: 管理者の承認フロー（1日）

```
Cursorプロンプト:

1. src/app/api/admin/pro/applications/route.ts を作成:
   - GET: 全申請一覧（ステータスフィルタ付き）

2. src/app/api/admin/pro/applications/[id]/route.ts を作成:
   - PATCH: approve → profiles 更新（is_certified_pro, pro_specialty, pro_certified_at）+ 承認メール
   - PATCH: reject → ステータス更新 + 却下メール

3. 管理画面に「公認再生プロ申請」タブを追加（既存の管理画面を拡張）:
   - 申請一覧テーブル（ニックネーム、専門分野、申請日、ステータス）
   - 申請詳細モーダル（申請内容全文、承認/却下ボタン、内部メモ）

※ 当面は管理画面がなくても、Supabase ダッシュボードから
   直接 SQL で profiles.is_certified_pro = true にすることで運用可能。
   管理画面は後回しでもOK。
```

### Phase 5: コラム記事機能（3日）

```
Cursorプロンプト:

1. コラム一覧ページ src/app/(public)/articles/page.tsx を作成:
   - 記事カード一覧（Section 6-4 のUI）
   - 専門分野フィルタ、タグフィルタ
   - ページネーション（20件/ページ）
   - loading.tsx にスケルトン

2. コラム詳細ページ src/app/(public)/articles/[id]/page.tsx を作成:
   - 記事本文のマークダウンレンダリング（react-markdown + rehype-sanitize）
   - 著者情報（アバター + バッジ + 専門タグ）
   - 閲覧カウント（article_views で重複排除）
   - 「この著者の他の記事」セクション
   - 「運営を通じてこの人に相談する」ボタン

3. コラム執筆ページ src/app/(protected)/articles/new/page.tsx を作成:
   - Section 6-8 のUI
   - マークダウンプレビュー機能（タブ切替）
   - 下書き保存 / 公開 ボタン
   - タグ入力（最大5つ、Enterで追加、✕で削除）

4. 記事API:
   - src/app/api/articles/route.ts（GET: 一覧, POST: 作成）
   - src/app/api/articles/[id]/route.ts（GET: 詳細, PATCH: 編集, DELETE: 削除）
   - src/app/api/articles/[id]/view/route.ts（POST: 閲覧カウント）
   - src/app/api/my/articles/route.ts（GET: 自分の記事一覧）

5. pnpm add react-markdown rehype-sanitize remark-gfm
```

### Phase 6: 公認再生プロ一覧（2日）

```
Cursorプロンプト:

1. プロ一覧ページ src/app/(public)/pro/page.tsx を作成:
   - Section 6-6 のUI
   - 専門分野フィルタ（タブ形式）
   - 経験フェーズフィルタ（ドロップダウン）
   - ソート（回答が多い順 / 共感が多い順 / 新着順）
   - ページネーション

2. src/app/api/pro/members/route.ts を作成:
   - GET: 公認再生プロ一覧（フィルタ・ソート・ページネーション対応）
   - クエリ: profiles JOIN して統計を集計

3. ヘッダーナビに「プロのコラム」「プロ一覧」リンクを追加
   - デスクトップ: ナビバーに直接表示
   - モバイル: ハンバーガーメニュー内に追加
```

### Phase 7: 相談リクエスト機能（2日）

```
Cursorプロンプト:

1. src/components/pro/contact-request-modal.tsx を作成:
   - Section 6-7 のUI
   - 件名（100文字）+ 本文（2000文字）+ 文字数カウント
   - 送信成功後の確認表示

2. src/app/api/contact-requests/route.ts を作成:
   - POST: バリデーション → INSERT → master@jugyoin.jp にメール
   - レート制限: 1ユーザー3回/日

3. src/app/(protected)/contact-requests/page.tsx を作成:
   - 自分が送ったリクエスト一覧（ステータス表示）

4. 管理者用:
   - src/app/api/admin/contact-requests/route.ts（一覧取得）
   - src/app/api/admin/contact-requests/[id]/route.ts（転送/クローズ）
   - 転送時にプロへメール通知
```

---

## 12. 既存ファイルへの影響

| ファイル | 変更内容 |
|---------|---------|
| `user_role` ENUM | 変更なし（公認再生プロはENUM追加ではなく `is_certified_pro` フラグで管理） |
| `profiles` テーブル | `is_certified_pro`, `pro_specialty`, `pro_certified_at` カラム追加 |
| ヘッダーコンポーネント | 「プロのコラム」「プロ一覧」リンク追加、ログイン後にバッジ表示 |
| 相談一覧/詳細 | 回答者名横にバッジ表示 |
| 返信コンポーネント | 投稿者名横にバッジ表示 |
| マイページ | 「公認再生プロ」セクション追加 |
| 管理画面 | 申請管理・リクエスト管理タブ追加 |
| 公開プロフィール | バッジ + 専門タグ + コラム一覧追加 |
| `notification_type` ENUM | 拡張不要（Resend 直接送信で対応） |

---

## 13. 将来拡張メモ

| 機能 | 説明 | 優先度 |
|------|------|--------|
| コラムへのコメント | 記事にスレッド形式のコメントを付けられる | 中 |
| コラムの共感（いいね） | 記事に共感ボタンを付ける | 中 |
| プロのレビュー/評価 | 相談リクエスト利用者がプロを5段階評価 | 低 |
| プロの有料プラン | 月額課金で露出優先、コラム本数上限拡大 | 低 |
| AIによる申請スクリーニング | 申請内容をAIで一次チェックし、運営の負担軽減 | 低 |
| 動画コラム | YouTube埋め込み対応のコラム形式 | 低 |
| プロ同士のディスカッション | 公認再生プロ限定の掲示板 | 低 |
