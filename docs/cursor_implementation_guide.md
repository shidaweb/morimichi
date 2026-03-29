# Cursor 実装指示書 — 早期事業再生コミュニティ MVP

> **この文書の使い方**: Cursor の AI に渡して Vibe coding でMVPを構築するための指示書です。
> 事業設計書 `jigyou_saisei_community_MVP_spec_v3.md` と併せて使用してください。

---

## 1. プロジェクト概要

経営苦境にいる経営者が匿名で相談を投稿し、経験者・支援者から回答を受けられるQ&Aプラットフォーム。Yahoo!ファイナンス掲示板のようなスレッド形式で、「相談者」と「回答者」のロールを分けた構造が特徴。

---

## 2. 技術スタック（Cloudflare Workers 中心）

```
フレームワーク:    Next.js 15 (App Router)
CF適応:           @opennextjs/cloudflare
UIライブラリ:      Tailwind CSS + shadcn/ui
DB/Auth:          Supabase (PostgreSQL + Auth + RLS)
ホスティング:      Cloudflare Workers
静的アセット:      Cloudflare Workers Static Assets
KVストア:          Cloudflare KV（レート制限・セッションキャッシュ）
メール:            Resend
監視:              Sentry（CF Workers SDK）
分析:              GA4 + Cloudflare Web Analytics
DNS/CDN/WAF:      Cloudflare（統合）
CI/CD:            wrangler deploy
言語:              TypeScript (strict mode)
パッケージ管理:    pnpm
```

### Cloudflare Workers 固有の設定

**wrangler.toml（プロジェクトルートに配置）:**

```toml
#:schema node_modules/wrangler/config-schema.json
name = "morimichi"
main = ".open-next/worker.js"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

# Static Assets（ビルド済みHTML/CSS/JS/画像）
[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# KV Namespace（レート制限・キャッシュ）
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<KV_NAMESPACE_ID>"

# 環境変数（Secrets は `wrangler secret put` で設定）
[vars]
NEXT_PUBLIC_SUPABASE_URL = "https://xxxx.supabase.co"
NEXT_PUBLIC_SITE_URL = "https://morimichi.jp"

# Secrets（wrangler secret put で設定。toml には書かない）
# SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# RESEND_API_KEY
# SENTRY_DSN
```

**package.json scripts:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "preview": "opennextjs-cloudflare && wrangler dev",
    "deploy": "opennextjs-cloudflare && wrangler deploy",
    "cf-typegen": "wrangler types"
  }
}
```

---

## 3. ディレクトリ構成

```
/
├── wrangler.toml                  # Cloudflare Workers 設定
├── open-next.config.ts            # OpenNext 設定
├── env.d.ts                       # Cloudflare 環境型定義
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # 認証関連（レイアウト共有）
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (main)/                # メインレイアウト
│   │   │   ├── consultations/
│   │   │   │   ├── page.tsx       # 相談一覧
│   │   │   │   ├── new/page.tsx   # 相談投稿（構造化入力）
│   │   │   │   └── [id]/page.tsx  # 相談詳細（スレッド表示）
│   │   │   ├── support/page.tsx   # 支援リンク一覧
│   │   │   ├── mypage/page.tsx    # マイページ
│   │   │   └── withdrawal/page.tsx # 退会
│   │   ├── (admin)/               # 管理画面
│   │   │   └── admin/
│   │   │       ├── reports/page.tsx
│   │   │       ├── consultations/page.tsx
│   │   │       └── users/page.tsx
│   │   ├── (legal)/               # 法的ページ
│   │   │   ├── terms/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── tokushoho/page.tsx
│   │   ├── api/                   # Route Handlers
│   │   │   ├── auth/
│   │   │   ├── consultations/
│   │   │   ├── replies/
│   │   │   ├── reactions/
│   │   │   ├── reports/
│   │   │   ├── phases/
│   │   │   └── admin/
│   │   ├── layout.tsx             # Root Layout
│   │   ├── page.tsx               # トップページ（LP）
│   │   ├── not-found.tsx          # 404
│   │   └── error.tsx              # エラーバウンダリ
│   ├── components/
│   │   ├── ui/                    # shadcn/ui コンポーネント
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── RoleSelector.tsx   # 相談者/回答者/両方の選択UI
│   │   ├── consultation/
│   │   │   ├── ConsultationCard.tsx
│   │   │   ├── ConsultationDetail.tsx
│   │   │   ├── PhaseSelector.tsx  # フェーズ選択（アイコンタイル）
│   │   │   ├── ConcernSelector.tsx # 困りごとプルダウン
│   │   │   ├── ConsultationForm.tsx
│   │   │   └── ViewCounter.tsx    # 閲覧数表示
│   │   ├── thread/
│   │   │   ├── ReplyThread.tsx    # スレッド表示
│   │   │   ├── ReplyItem.tsx      # 個別回答/返信
│   │   │   ├── ReplyForm.tsx      # 回答/返信入力
│   │   │   └── PersonalOpinionCheck.tsx
│   │   ├── common/
│   │   │   ├── ReactionButton.tsx
│   │   │   ├── ReportButton.tsx
│   │   │   ├── CrisisBanner.tsx
│   │   │   ├── DisclaimerBanner.tsx
│   │   │   └── Pagination.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── MobileNav.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # ブラウザ用 Supabase クライアント
│   │   │   ├── server.ts          # サーバー用（Edge互換）
│   │   │   └── admin.ts           # Service Role クライアント
│   │   ├── cloudflare/
│   │   │   ├── kv.ts              # KV ヘルパー（レート制限用）
│   │   │   └── env.ts             # Cloudflare 環境変数取得ヘルパー
│   │   ├── email/
│   │   │   ├── resend.ts
│   │   │   └── templates/
│   │   │       ├── reply-notification.tsx
│   │   │       ├── welcome.tsx
│   │   │       └── password-reset.tsx
│   │   ├── validations/
│   │   │   ├── consultation.ts    # Zod スキーマ
│   │   │   ├── reply.ts
│   │   │   ├── auth.ts
│   │   │   └── report.ts
│   │   ├── crisis-detection.ts
│   │   ├── rate-limit.ts          # Cloudflare KV ベースのレート制限
│   │   └── constants.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useConsultations.ts
│   │   ├── useReplies.ts
│   │   └── useReactions.ts
│   └── types/
│       ├── database.ts            # Supabase 生成型定義
│       └── cloudflare.ts          # Cloudflare Workers 型定義
├── middleware.ts                   # Next.js ミドルウェア（認証チェック）
└── open-next.config.ts            # OpenNext 設定ファイル
```

---

## 4. Cloudflare Workers 固有の実装パターン

### 4-1. Supabase クライアント（Edge Runtime 対応）

```typescript
// src/lib/supabase/server.ts
// Cloudflare Workers 上で動作する SSR 用 Supabase クライアント
// @supabase/ssr は使わない（Node.js stream 依存問題を回避）

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  const refreshToken = cookieStore.get('sb-refresh-token')?.value

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  // リフレッシュトークンでセッション復元
  if (refreshToken && accessToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
  }

  return supabase
}
```

### 4-2. レート制限（Cloudflare KV ベース）

```typescript
// src/lib/rate-limit.ts
// Cloudflare KV を使ったレート制限
// getCloudflareContext() で KV バインディングにアクセス

import { getCloudflareContext } from '@opennextjs/cloudflare'

interface RateLimitConfig {
  key: string         // e.g., "post:user123"
  limit: number       // 上限
  windowSeconds: number // ウィンドウ秒数
}

export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  const { env } = await getCloudflareContext()
  const kv = env.RATE_LIMIT_KV

  const now = Math.floor(Date.now() / 1000)
  const windowKey = `${config.key}:${Math.floor(now / config.windowSeconds)}`

  const current = parseInt(await kv.get(windowKey) || '0', 10)

  if (current >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: (Math.floor(now / config.windowSeconds) + 1) * config.windowSeconds,
    }
  }

  await kv.put(windowKey, String(current + 1), {
    expirationTtl: config.windowSeconds * 2,
  })

  return {
    allowed: true,
    remaining: config.limit - current - 1,
    resetAt: (Math.floor(now / config.windowSeconds) + 1) * config.windowSeconds,
  }
}

// 使用例（Route Handler内）:
// const result = await checkRateLimit({
//   key: `consultation:${userId}`,
//   limit: 3,
//   windowSeconds: 86400, // 1日
// })
// if (!result.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
```

### 4-3. 環境変数の取得（Cloudflare Workers 環境）

```typescript
// src/lib/cloudflare/env.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function getEnv() {
  const { env } = await getCloudflareContext()
  return {
    SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    RESEND_API_KEY: env.RESEND_API_KEY || process.env.RESEND_API_KEY!,
    SENTRY_DSN: env.SENTRY_DSN || process.env.SENTRY_DSN!,
  }
}
```

### 4-4. OpenNext 設定ファイル

```typescript
// open-next.config.ts
import type { OpenNextConfig } from '@opennextjs/cloudflare'

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'dummy',
    },
  },
}

export default config
```

### 4-5. Cloudflare 環境型定義

```typescript
// env.d.ts
interface CloudflareEnv {
  ASSETS: Fetcher
  RATE_LIMIT_KV: KVNamespace
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SITE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  RESEND_API_KEY: string
  SENTRY_DSN: string
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends CloudflareEnv {}
  }
}
```

---

## 5. DB マイグレーション（Supabase SQL）

以下のSQLを Supabase の SQL Editor で順番に実行してください。

### 5-1. ENUMと基本テーブル

```sql
-- ENUMs
CREATE TYPE user_role AS ENUM ('consulter', 'advisor', 'both', 'moderator', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'withdrawn');
CREATE TYPE content_status AS ENUM ('published', 'hidden', 'deleted');
CREATE TYPE report_reason AS ENUM ('defamation', 'solicitation', 'crisis', 'personal_info', 'illegal', 'misinformation', 'legal_advice', 'advisor_solicitation', 'spam', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE moderation_action_type AS ENUM ('hide', 'delete', 'warn', 'suspend', 'ban', 'no_action');
CREATE TYPE reaction_target AS ENUM ('consultation', 'reply');
CREATE TYPE notification_type AS ENUM ('reply_to_consultation', 'reply_to_reply', 'report_resolved', 'account_warning', 'welcome', 'password_reset', 'withdrawal');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE post_handling AS ENUM ('anonymize', 'delete');
CREATE TYPE support_category AS ENUM ('public', 'legal', 'financial', 'mental', 'other');

-- Users（Supabase Auth の auth.users と連携）
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'consulter',
  status user_status NOT NULL DEFAULT 'active',
  nickname VARCHAR(20) UNIQUE NOT NULL,
  bio TEXT,
  experience_phases TEXT[],
  notification_on_reply BOOLEAN DEFAULT true,
  notification_on_reaction BOOLEAN DEFAULT false,
  notification_digest BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phases（フェーズマスタ）
CREATE TABLE public.phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,
  icon VARCHAR,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Concerns（困りごとマスタ）
CREATE TABLE public.concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.phases(id) NOT NULL,
  label VARCHAR NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  triggers_crisis BOOLEAN DEFAULT false
);

-- Consultations（相談）
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES public.phases(id) NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  status content_status NOT NULL DEFAULT 'published',
  crisis_flag BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Consultation-Concerns（中間テーブル）
CREATE TABLE public.consultation_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  concern_id UUID REFERENCES public.concerns(id) NOT NULL,
  UNIQUE(consultation_id, concern_id)
);

-- Replies（回答・返信）
CREATE TABLE public.replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_reply_id UUID REFERENCES public.replies(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 2),
  status content_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reaction Type（将来拡張を見越して ENUM 化）
CREATE TYPE public.reaction_type AS ENUM ('empathy');

-- Reactions（共感）
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_type reaction_target NOT NULL,
  target_id UUID NOT NULL,
  reaction_type reaction_type NOT NULL DEFAULT 'empathy',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id, reaction_type)
);

-- Reports（通報）
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES auth.users(id) NOT NULL,
  target_type reaction_target NOT NULL,
  target_id UUID NOT NULL,
  reason report_reason NOT NULL,
  detail TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Moderation Actions
CREATE TABLE public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id UUID REFERENCES auth.users(id) NOT NULL,
  report_id UUID REFERENCES public.reports(id),
  target_type VARCHAR NOT NULL CHECK (target_type IN ('consultation', 'reply', 'user')),
  target_id UUID NOT NULL,
  action moderation_action_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Support Links（支援機関）
CREATE TABLE public.support_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  category support_category NOT NULL,
  description TEXT,
  url VARCHAR NOT NULL,
  phone_number VARCHAR,
  is_paid_listing BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email Notifications
CREATE TABLE public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type notification_type NOT NULL,
  payload JSONB,
  status notification_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Consultation Views（閲覧カウント重複排除）
CREATE TABLE public.consultation_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES auth.users(id),
  ip_hash VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(consultation_id, ip_hash)
);

-- Access Logs
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ip_address VARCHAR NOT NULL,
  user_agent VARCHAR,
  action VARCHAR,
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Withdrawal Records
CREATE TABLE public.withdrawal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  post_handling post_handling NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5-2. インデックス

```sql
CREATE INDEX idx_consultations_phase ON consultations(phase_id, status, created_at DESC);
CREATE INDEX idx_consultations_user ON consultations(user_id) WHERE status = 'published';
CREATE INDEX idx_consultations_crisis ON consultations(crisis_flag) WHERE crisis_flag = true;
CREATE INDEX idx_consultation_concerns_cid ON consultation_concerns(consultation_id);
CREATE INDEX idx_consultation_concerns_concern ON consultation_concerns(concern_id);
CREATE INDEX idx_replies_consultation ON replies(consultation_id, status, created_at);
CREATE INDEX idx_replies_parent ON replies(parent_reply_id) WHERE parent_reply_id IS NOT NULL;
CREATE INDEX idx_replies_user ON replies(user_id);
CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_email_notifications_pending ON email_notifications(status) WHERE status = 'pending';
CREATE INDEX idx_consultation_views_cid ON consultation_views(consultation_id);
CREATE INDEX idx_access_logs_user ON access_logs(user_id, created_at);
CREATE INDEX idx_access_logs_ip ON access_logs(ip_address, created_at);
```

### 5-3. RLS ポリシー

```sql
-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Consultations
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published consultations" ON consultations
  FOR SELECT USING (status = 'published');

CREATE POLICY "Consulters and both can create consultations" ON consultations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('consulter', 'both', 'admin')
    )
  );

CREATE POLICY "Users can update own consultations" ON consultations
  FOR UPDATE USING (auth.uid() = user_id);

-- Replies
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published replies" ON replies
  FOR SELECT USING (status = 'published');

CREATE POLICY "Advisors and both can create replies" ON replies
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      (parent_reply_id IS NULL AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('advisor', 'both', 'moderator', 'admin')
      ))
      OR
      (parent_reply_id IS NOT NULL)
    )
  );

-- Reactions
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone logged in can read reactions" ON reactions
  FOR SELECT USING (true);

CREATE POLICY "Logged in users can create reactions" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logged in users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Admins and moderators can read reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('moderator', 'admin')
    )
  );
```

### 5-4. 初期マスタデータ

```sql
-- フェーズ
INSERT INTO phases (name, slug, icon, description, sort_order) VALUES
  ('資金繰り', 'shikin-guri', '💰', '運転資金・返済・キャッシュフローの悩み', 1),
  ('税金', 'zeikin', '🏛️', '税金の支払い・滞納・延納の悩み', 2),
  ('係争', 'keisou', '⚖️', '取引先・従業員・金融機関とのトラブル', 3),
  ('再生', 'saisei', '🔄', '事業の立て直し・民事再生・事業承継', 4),
  ('破産', 'hasan', '📉', '自己破産・法人破産の検討', 5),
  ('清算', 'seisan', '📋', '廃業・会社清算・事業譲渡', 6),
  ('メンタル・孤独', 'mental', '🧠', '精神的な辛さ・孤立感', 7),
  ('その他', 'other', '💬', '上記に当てはまらない相談', 8);

-- 困りごと（資金繰り）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '運転資金が足りない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '銀行借入の返済が厳しい', 2, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), 'リスケジュール（返済条件変更）を検討中', 3, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '追加融資を断られた', 4, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '取引先への支払いが遅れている', 5, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '給与の支払いが厳しい', 6, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), 'ゼロゼロ融資の返済が始まった', 7, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '資金調達の方法がわからない', 8, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), 'その他', 9, false);

-- 困りごと（税金）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '消費税を納められない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '法人税・所得税が払えない', 2, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '社会保険料を滞納している', 3, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '税務署から督促が来ている', 4, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '延納・分割納付を相談したい', 5, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '税理士に相談すべきかわからない', 6, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), 'その他', 7, false);

-- 困りごと（係争）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'keisou'), '取引先との契約トラブル', 1, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '従業員との労務トラブル', 2, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '金融機関との交渉がうまくいかない', 3, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '訴訟を起こされた / 起こしたい', 4, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '債権回収ができない', 5, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '弁護士に相談すべきかわからない', 6, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), 'その他', 7, false);

-- 困りごと（再生）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'saisei'), '民事再生の手続きがわからない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), '再生計画を作りたいがどうすればいいか', 2, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), '事業承継を検討中', 3, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), 'M&Aで事業を引き継ぎたい', 4, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), 'スポンサー（支援者）を探している', 5, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), '再生した人の経験を聞きたい', 6, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), 'その他', 7, false);

-- 困りごと（破産）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'hasan'), '自己破産すべきか迷っている', 1, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '法人破産の手続きがわからない', 2, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '連帯保証の影響が知りたい', 3, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '破産後の生活が不安', 4, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '家族への影響が心配', 5, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '破産を経験した人の話を聞きたい', 6, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), 'その他', 7, false);

-- 困りごと（清算）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'seisan'), '廃業の手続きがわからない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '従業員の解雇・退職の対応', 2, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '事業の畳み方がわからない', 3, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '在庫・設備の処分方法', 4, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '取引先への通知の仕方', 5, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '廃業後のキャリアが不安', 6, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), 'その他', 7, false);

-- 困りごと（メンタル・孤独）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'mental'), '誰にも相談できない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '眠れない・体調が悪い', 2, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '経営者としての孤独感', 3, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '家族との関係が悪化している', 4, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '自分を責めてしまう', 5, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '死にたい気持ちがある', 6, true),
  ((SELECT id FROM phases WHERE slug = 'mental'), 'その他', 7, false);

-- 困りごと（その他）
INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'other'), '何に困っているかわからないがとにかく辛い', 1, false),
  ((SELECT id FROM phases WHERE slug = 'other'), '誰かに話を聞いてほしい', 2, false),
  ((SELECT id FROM phases WHERE slug = 'other'), 'その他', 3, false);

-- 支援リンク初期データ
INSERT INTO support_links (name, category, description, url, phone_number, sort_order) VALUES
  ('法テラス（日本司法支援センター）', 'legal', '法的トラブルの総合相談窓口。無料法律相談あり。', 'https://www.houterasu.or.jp/', '0570-078374', 1),
  ('よろず支援拠点', 'public', '中小企業・小規模事業者の経営相談窓口。無料。', 'https://yorozu.smrj.go.jp/', NULL, 2),
  ('中小企業再生支援協議会', 'financial', '事業再生の専門的支援。各都道府県に設置。', 'https://www.smrj.go.jp/sme/enhancement/succession/', NULL, 3),
  ('いのちの電話', 'mental', '24時間対応の電話相談。', 'https://www.inochinodenwa.org/', '0120-783-556', 4),
  ('よりそいホットライン', 'mental', '24時間無料の電話相談。', 'https://www.since2011.net/yorisoi/', '0120-279-338', 5),
  ('日本弁護士連合会', 'legal', '弁護士会の相談窓口検索。', 'https://www.nichibenren.or.jp/', NULL, 6),
  ('日本政策金融公庫', 'financial', '中小企業向け融資の相談。', 'https://www.jfc.go.jp/', NULL, 7),
  ('事業承継・引継ぎ支援センター', 'public', 'M&A・事業承継の無料相談。', 'https://shoukei.smrj.go.jp/', NULL, 8);
```

---

## 6. 実装順序（Cursorに渡す順番）

### Phase 1: 基盤（Week 1-2）

```
Cursorへの指示:
「Next.js 15 + Supabase + Tailwind + shadcn/ui + Cloudflare Workers でプロジェクトを
初期化してください。TypeScript strict mode、pnpm を使います。

Cloudflare Workers へのデプロイは @opennextjs/cloudflare を使います。
以下をセットアップしてください:
- pnpm create next-app でプロジェクト作成
- pnpm add @opennextjs/cloudflare
- wrangler.toml の作成（上記のテンプレート参照）
- open-next.config.ts の作成
- env.d.ts でCloudflare環境の型定義
- pnpm preview で Wrangler ローカルプレビューが動くことを確認

Supabase は上記のDBスキーマを作成し、RLSポリシーを設定してください。
Supabase クライアントは @supabase/ssr を使わず、@supabase/supabase-js を直接使い
Cookie ベースでセッション管理してください（Edge Runtime互換のため）。

認証機能として、ロール別登録（相談者/回答者/両方）、ログイン、メール認証、
パスワードリセットを実装してください。
登録フォームには RoleSelector コンポーネント（3択のラジオボタン）を含めてください。
回答者を選んだ場合は追加で経験フェーズの複数選択入力を表示してください。」
```

### Phase 2: 相談投稿・一覧（Week 3）

```
Cursorへの指示:
「構造化された相談投稿機能を実装してください。
Step 1: PhaseSelector（8フェーズのアイコンタイル選択）
Step 2: ConcernSelector（選択フェーズの困りごと複数選択プルダウン）
Step 3: タイトル入力（100文字以内）
Step 4: 本文入力（10,000文字以内）
投稿前に注意事項を表示し、プレビュー確認後に送信。
困りごとに triggers_crisis=true の項目が含まれる場合、crisis_flag=true にして
危機対応バナーを表示してください。
一覧画面はフェーズ別タブフィルタ、ソート（新着/回答多い/閲覧数順）、
カーソルベースページネーションを含めてください。
各カードに閲覧数、回答数、共感数を表示してください。」
```

### Phase 3: スレッド型返信（Week 4）

```
Cursorへの指示:
「Yahoo!ファイナンス掲示板のようなスレッド型回答・返信を実装してください。
構造は3階層: 相談 → 回答(depth=1) → 返信(depth=2)。
回答者が直接回答を投稿でき、相談者と回答者がスレッド内で返信できます。
回答投稿時に「個人的な経験・見解としてお伝えします」チェックボックスを必須にしてください。
閲覧カウントは consultation_views テーブルで IPハッシュ による重複排除をしてください。
Cloudflare Workers では request ヘッダーの CF-Connecting-IP でIPを取得してください。
相談詳細ページに閲覧件数を「👁 142閲覧」のように表示してください。
共感ボタンと通報ボタンを各回答・返信に設置してください。」
```

### Phase 4: 通知（Week 5）

```
Cursorへの指示:
「Resendを使った双方向メール通知を実装してください。
- 相談に回答がついたら相談者にメール
- 回答に返信がついたら回答者にメール
- 返信に返信がついたらスレッド参加者にメール
メール本文には投稿内容を含めず、「回答がありました。サイトで確認してください」
+ リンクのみにしてください（匿名性保護）。
同一スレッドからの通知は1時間以内にまとめて1通にしてください。
Cloudflare KV を使って通知のダイジェストキューを管理してください。
マイページに通知設定（ON/OFF）を追加してください。」
```

### Phase 5: モデレーション・安全機能（Week 6-7）

```
Cursorへの指示:
「通報機能と管理画面を実装してください。
通報理由は10種類（defamation, solicitation, crisis, personal_info, illegal,
misinformation, legal_advice, advisor_solicitation, spam, other）。
管理画面には通報一覧、投稿管理、ユーザー管理を含めます。
危機キーワード検知（死にたい、消えたい、楽になりたい、自殺、等）で
crisis_flag を自動セットし、CrisisBanner コンポーネントを表示してください。
注意喚起バナー（DisclaimerBanner）をすべての相談詳細ページに固定表示してください。
支援リンク一覧ページも実装してください。」
```

### Phase 6: 仕上げ（Week 8-10）

```
Cursorへの指示:
「トップページ（LP）を実装してください。
2つのCTA: 「相談してみる」「経験を活かして回答する」。
最新の相談3件をプレビュー表示。
利用規約、プライバシーポリシー、特商法ページを作成してください。
退会機能（投稿の匿名化 or 削除を選択可能）を実装してください。
レート制限を Cloudflare KV ベースで実装してください
（相談3件/日、回答20件/日、返信30件/日）。
404/500エラーページを温かいトーンで作成してください。
SEO対応（メタタグ、OGP、sitemap.xml）を設定してください。
レスポンシブ対応（モバイルファースト）を確認してください。

最後にデプロイの確認:
- pnpm build && pnpm preview でローカル確認
- pnpm deploy で Cloudflare Workers にデプロイ
- カスタムドメインを Cloudflare Dashboard で設定」
```

---

## 7. デプロイ手順

### 初回セットアップ

```bash
# 1. Wrangler CLI インストール
pnpm add -D wrangler @opennextjs/cloudflare

# 2. Cloudflare にログイン
npx wrangler login

# 3. KV Namespace 作成
npx wrangler kv namespace create RATE_LIMIT_KV
# → 出力された id を wrangler.toml に設定

# 4. Secrets 設定
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SENTRY_DSN

# 5. デプロイ
pnpm deploy
# → https://morimichi.<account>.workers.dev にデプロイ完了
```

### カスタムドメイン設定

```bash
# Cloudflare Dashboard > Workers & Pages > morimichi > Settings > Domains & Routes
# → カスタムドメイン追加（例: morimichi.jp）
# → DNS の CNAME レコードが自動設定される
```

### ロールバック

```bash
# 直前のバージョンに即座にロールバック
npx wrangler rollback
```

---

## 8. 重要な実装ノート

### トーン＆マナー（UIテキスト）

- 基本トーン: 「重すぎず、軽すぎず。孤独に寄り添う。でも前を向いている」
- 禁止ワード: 「解決します」「安心してください」「必ず」「簡単に」
- 推奨ワード: 「話してみませんか」「一人じゃないかもしれません」「読んでいます」「経験者がいます」
- カラー: 深緑 (#2D5A3D) / テラコッタ (#C67B5C) / クリーム (#F5F0E8)
- フォント: Noto Sans JP（丸みのあるゴシック系）

### セキュリティチェックリスト

- [ ] パスワードは bcrypt でハッシュ化（Supabase Auth が自動処理）
- [ ] すべてのAPIで認証チェック
- [ ] RLSポリシーが正しく動作することをテスト
- [ ] XSS対策: ユーザー入力はすべてサニタイズ
- [ ] Cloudflare WAF ルールを有効化
- [ ] レート制限の実装（Cloudflare KV ベース）
- [ ] 閲覧カウントの水増し防止（CF-Connecting-IP でIP取得）
- [ ] access_logs にIPアドレスを記録
- [ ] Secrets は `wrangler secret put` で設定（コードにハードコードしない）

### Cloudflare Workers 固有のチェックリスト

- [ ] `wrangler.toml` の `compatibility_flags = ["nodejs_compat"]` を確認
- [ ] `@supabase/ssr` を使わず `@supabase/supabase-js` 直接使用
- [ ] `getCloudflareContext()` で KV・環境変数にアクセス
- [ ] IP取得は `request.headers.get('CF-Connecting-IP')`
- [ ] `pnpm preview` でローカル動作確認（Wrangler ローカル環境）
- [ ] `pnpm deploy` でデプロイ成功を確認

### 非弁リスク対策チェックリスト

- [ ] 回答投稿時の「個人的見解です」チェック必須
- [ ] 全相談詳細ページに DisclaimerBanner 固定表示
- [ ] 支援リンクは公的機関優先、特定事務所への誘導なし
- [ ] 断定表現（「〜すべき」「必ず〜」）の自動検知と注意バナー表示

---

*この指示書は jigyou_saisei_community_MVP_spec_v3.md と併せて使用してください。*
*version: 2.0 | 作成日: 2026年3月 | Cloudflare Workers 対応版*
