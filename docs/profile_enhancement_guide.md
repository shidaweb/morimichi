# プロフィール拡張機能 — Cursor 実装指示書

> **この文書の使い方**: Cursor の AI に渡してプロフィール機能を拡張するための指示書です。
> `jigyou_saisei_community_MVP_spec_v3.md` と `cursor_implementation_guide.md` と併せて使用してください。
> 技術スタック: Next.js 15 (App Router) + Cloudflare Workers + Supabase + shadcn/ui

---

## 1. 機能概要

現在の `profiles` テーブルには `nickname`, `bio`, `experience_phases` のみ。
以下の3機能を追加し、マイページを充実させる。

| # | 機能 | 概要 |
|---|------|------|
| 1 | アバター画像のアップロード・表示 | ユーザーが自分のプロフィール画像を設定。相談・返信・マイページで表示 |
| 2 | マイページの充実 | 自己紹介・経験フェーズ・活動統計・相談/回答履歴をまとめて表示・編集 |
| 3 | 公開プロフィール | 回答者のプロフィールを他ユーザーが閲覧可能（信頼性向上） |

---

## 2. データベース変更

### 2-1. profiles テーブルへのカラム追加

```sql
-- マイグレーション: add_profile_fields.sql

-- アバター画像URL（Supabase Storage のパス）
ALTER TABLE public.profiles
  ADD COLUMN avatar_url TEXT;

-- 肩書き・一行紹介（回答者の専門性アピール用）
ALTER TABLE public.profiles
  ADD COLUMN headline VARCHAR(60);

-- 所在地（都道府県レベル、任意）
ALTER TABLE public.profiles
  ADD COLUMN prefecture VARCHAR(10);

-- 経験年数（経営者としての年数、任意）
ALTER TABLE public.profiles
  ADD COLUMN years_of_experience INTEGER CHECK (years_of_experience >= 0 AND years_of_experience <= 99);

-- プロフィール公開設定（回答者のみ有効）
ALTER TABLE public.profiles
  ADD COLUMN is_profile_public BOOLEAN DEFAULT false;

-- SNS/Webサイトリンク（任意、1つだけ。匿名性重視のため最小限）
ALTER TABLE public.profiles
  ADD COLUMN website_url TEXT;
```

### 2-2. Supabase Storage バケット作成

```sql
-- Storage バケット（Supabase ダッシュボードまたは SQL で作成）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- 公開バケット（URLで誰でも閲覧可能）
  1048576,  -- 1MB 上限
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);
```

### 2-3. Storage RLS ポリシー

```sql
-- 誰でもアバター画像を閲覧可能
CREATE POLICY "Public avatar access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- 自分のフォルダにのみアップロード可能
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 自分のアバターのみ更新可能
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 自分のアバターのみ削除可能
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 2-4. profiles テーブル RLS 更新（変更なし、確認のみ）

```sql
-- 既存ポリシーで対応済み:
-- "Anyone can read profiles" → 公開プロフィール閲覧に使える
-- "Users can update own profile" → 新カラムも自動的にカバー
-- 追加ポリシー不要
```

---

## 3. API エンドポイント

### 3-1. 新規・変更エンドポイント

| メソッド | パス | 説明 | 認証 | 新規/変更 |
|---------|------|------|------|----------|
| PATCH | `/api/users/me` | プロフィール更新（既存 + 新フィールド） | 必要 | **変更** |
| POST | `/api/users/me/avatar` | アバター画像アップロード | 必要 | **🆕** |
| DELETE | `/api/users/me/avatar` | アバター画像削除 | 必要 | **🆕** |
| GET | `/api/users/:nickname` | 公開プロフィール取得 | 不要 | **🆕** |

### 3-2. API 詳細設計

#### POST `/api/users/me/avatar`

```typescript
// リクエスト: multipart/form-data
// - file: 画像ファイル（JPEG/PNG/WebP、1MB以下）

// レスポンス（成功）:
{
  "avatar_url": "https://<project>.supabase.co/storage/v1/object/public/avatars/<user_id>/avatar.webp"
}

// バリデーション:
// - ファイルサイズ: 1MB 以下
// - MIME type: image/jpeg, image/png, image/webp のみ
// - 画像リサイズ: サーバーサイドで 200x200px に縮小（正方形クロップ）
// - フォーマット変換: WebP に統一（容量削減）
// - ファイル名: avatars/{user_id}/avatar.webp（常に上書き）
```

#### DELETE `/api/users/me/avatar`

```typescript
// レスポンス（成功）:
{ "message": "Avatar deleted" }

// 処理:
// 1. Storage からファイル削除
// 2. profiles.avatar_url を null に更新
```

#### GET `/api/users/:nickname`

```typescript
// レスポンス（成功）:
{
  "nickname": "経験者A",
  "avatar_url": "https://...",
  "headline": "元飲食店経営者。破産から再起した経験があります",
  "bio": "...",
  "prefecture": "東京都",
  "years_of_experience": 15,
  "experience_phases": ["資金繰り", "破産", "再生"],
  "role": "advisor",
  "stats": {
    "total_replies": 42,
    "total_reactions_received": 128,
    "member_since": "2026-01-15"
  }
}

// アクセス制御:
// - is_profile_public = true の回答者のみ表示
// - 相談者のプロフィールは非公開（404 返却）
// - 管理者・モデレーターは全プロフィール閲覧可
```

#### PATCH `/api/users/me`（既存エンドポイント拡張）

```typescript
// リクエストボディに追加フィールド:
{
  "nickname": "string (2-20文字)",       // 既存
  "bio": "string (500文字以下)",          // 既存
  "experience_phases": ["string"],       // 既存
  "notification_on_reply": true,         // 既存
  "notification_on_reaction": false,     // 既存
  "notification_digest": true,           // 既存
  // ↓ 新規追加
  "headline": "string (60文字以下)",
  "prefecture": "string (都道府県名)",
  "years_of_experience": 15,
  "is_profile_public": true,
  "website_url": "string (URL形式)"
}
```

---

## 4. 画面設計

### 4-1. マイページ（リニューアル）

```
┌─────────────────────────────────────────────────┐
│  ← もりみち                                       │
├─────────────────────────────────────────────────┤
│                                                   │
│   ┌──────┐                                        │
│   │ 📷   │  ニックネーム                           │
│   │avatar│  肩書き（headline）                     │
│   │      │  東京都 ・ 経験15年 ・ 回答者ロール       │
│   └──────┘                                        │
│   [プロフィールを編集]                              │
│                                                   │
│   ─────── 自己紹介 ───────                        │
│   元飲食店経営者。破産から再起した経験が            │
│   あります。同じ苦しみを味わった方の力に…          │
│                                                   │
│   ─────── 経験フェーズ ───────                    │
│   [💰 資金繰り] [⚖️ 破産] [🔄 再生]              │
│                                                   │
│   ─────── 活動サマリー ───────                    │
│   ┌──────────┬──────────┬──────────┐             │
│   │ 相談 3件  │ 回答 42件 │ 共感 128  │             │
│   └──────────┴──────────┴──────────┘             │
│                                                   │
│   ─────── 最近の活動 ───────                      │
│   [タブ: 自分の相談 | 自分の回答]                   │
│                                                   │
│   ▸ 資金繰りについて相談です...        3日前       │
│   ▸ 税金の分納について質問が...        1週間前      │
│                                                   │
│   ─────── 設定 ───────                            │
│   通知設定 >                                       │
│   ロール変更 >                                     │
│   退会 >                                           │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 4-2. プロフィール編集モーダル/ページ

```
┌─────────────────────────────────────────────────┐
│  プロフィールを編集                     [✕ 閉じる]│
├─────────────────────────────────────────────────┤
│                                                   │
│   プロフィール画像                                 │
│   ┌──────┐                                        │
│   │ 📷   │  [画像を変更]  [削除]                   │
│   │avatar│                                        │
│   └──────┘                                        │
│   JPEG/PNG/WebP、1MB以下                           │
│                                                   │
│   ニックネーム *                                   │
│   ┌────────────────────────────────────┐          │
│   │ 経験者A                              │          │
│   └────────────────────────────────────┘          │
│   2〜20文字                                       │
│                                                   │
│   肩書き・ひとこと                                 │
│   ┌────────────────────────────────────┐          │
│   │ 元飲食店経営者。再起経験あり          │          │
│   └────────────────────────────────────┘          │
│   60文字以下                                      │
│                                                   │
│   自己紹介                                         │
│   ┌────────────────────────────────────┐          │
│   │                                      │          │
│   │ （テキストエリア、500文字）            │          │
│   │                                      │          │
│   └────────────────────────────────────┘          │
│                                                   │
│   都道府県                                         │
│   ┌────────────────────┐                          │
│   │ 東京都            ▼ │                          │
│   └────────────────────┘                          │
│                                                   │
│   経営経験年数                                     │
│   ┌──────────┐                                    │
│   │ 15       年│                                    │
│   └──────────┘                                    │
│                                                   │
│   経験フェーズ（複数選択可） *回答者のみ            │
│   ☑ 資金繰り  ☐ 税金  ☐ 係争                     │
│   ☐ 再生  ☑ 破産  ☐ 清算                         │
│   ☐ メンタル・孤独  ☐ その他                      │
│                                                   │
│   ウェブサイト/SNS                                  │
│   ┌────────────────────────────────────┐          │
│   │ https://example.com                  │          │
│   └────────────────────────────────────┘          │
│                                                   │
│   ☑ プロフィールを公開する（回答者のみ）           │
│     他のユーザーがあなたのプロフィールを             │
│     閲覧できるようになります                       │
│                                                   │
│            [保存する]                              │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 4-3. アバター表示箇所（サイト全体）

| 表示箇所 | サイズ | フォールバック |
|---------|--------|-------------|
| ヘッダー（ログイン後） | 32×32px | ニックネーム頭文字のイニシャルアイコン |
| マイページ | 96×96px | 同上 |
| 公開プロフィール | 96×96px | 同上 |
| 相談カード（一覧） | 40×40px | 同上 |
| 相談詳細（投稿者） | 48×48px | 同上 |
| 返信（各回答者） | 36×36px | 同上 |

### 4-4. 公開プロフィールページ `/users/:nickname`

```
┌─────────────────────────────────────────────────┐
│  もりみち    相談一覧   支援リンク      ログイン   │
├─────────────────────────────────────────────────┤
│                                                   │
│   ┌──────┐                                        │
│   │      │  経験者A                               │
│   │avatar│  元飲食店経営者。再起経験あり            │
│   │      │  東京都 ・ 経験15年                     │
│   └──────┘  回答者 ・ 2026年1月から参加            │
│                                                   │
│   ─────── 自己紹介 ───────                        │
│   元飲食店経営者。破産から再起した経験が            │
│   あります。同じ苦しみを味わった方の力に…          │
│                                                   │
│   ─────── 経験フェーズ ───────                    │
│   [💰 資金繰り] [⚖️ 破産] [🔄 再生]              │
│                                                   │
│   ─────── 活動実績 ───────                        │
│   回答 42件  ・  もらった共感 128                   │
│                                                   │
│   ─────── この方の回答 ───────                    │
│   ▸ [資金繰り] 銀行との交渉について...    3日前    │
│   ▸ [破産] 免責手続きの流れは...         1週間前   │
│   ▸ もっと見る                                    │
│                                                   │
└─────────────────────────────────────────────────┘

※ 相談者のプロフィールは非公開（このページは表示されない）
※ is_profile_public = false の回答者も非公開
```

---

## 5. コンポーネント設計

### 5-1. 共通アバターコンポーネント

```typescript
// src/components/ui/user-avatar.tsx

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface UserAvatarProps {
  avatarUrl: string | null
  nickname: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',    // 32px — ヘッダー
  md: 'h-10 w-10 text-sm',  // 40px — 相談カード
  lg: 'h-12 w-12 text-base', // 48px — 相談詳細
  xl: 'h-24 w-24 text-2xl',  // 96px — マイページ・公開プロフ
}

export function UserAvatar({ avatarUrl, nickname, size = 'md', className }: UserAvatarProps) {
  // ニックネームの最初の文字をフォールバックに使用
  const initial = nickname.charAt(0)

  // 背景色をニックネームから決定論的に生成（一貫した色）
  const colorIndex = nickname.charCodeAt(0) % 6
  const bgColors = [
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-sky-100 text-sky-700',
    'bg-rose-100 text-rose-700',
    'bg-violet-100 text-violet-700',
    'bg-teal-100 text-teal-700',
  ]

  return (
    <Avatar className={`${sizeMap[size]} ${className || ''}`}>
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={`${nickname}のアバター`}
          loading="lazy"
        />
      )}
      <AvatarFallback className={bgColors[colorIndex]}>
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}
```

### 5-2. アバターアップロードコンポーネント

```typescript
// src/components/profile/avatar-upload.tsx

'use client'

import { useState, useRef, useCallback } from 'react'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Button } from '@/components/ui/button'
import { Camera, Trash2, Loader2 } from 'lucide-react'

interface AvatarUploadProps {
  currentAvatarUrl: string | null
  nickname: string
  onUploadSuccess: (newUrl: string) => void
  onDeleteSuccess: () => void
}

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function AvatarUpload({
  currentAvatarUrl,
  nickname,
  onUploadSuccess,
  onDeleteSuccess,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    // クライアント側バリデーション
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('JPEG、PNG、WebP 形式の画像を選択してください')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('画像サイズは 1MB 以下にしてください')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/users/me/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'アップロードに失敗しました')
      }

      const { avatar_url } = await res.json()
      onUploadSuccess(avatar_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
    } finally {
      setIsUploading(false)
      // input をリセット（同じファイルを再選択可能にする）
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [onUploadSuccess])

  const handleDelete = useCallback(async () => {
    if (!currentAvatarUrl) return
    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch('/api/users/me/avatar', { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      onDeleteSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }, [currentAvatarUrl, onDeleteSuccess])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <UserAvatar
          avatarUrl={currentAvatarUrl}
          nickname={nickname}
          size="xl"
        />
        {/* ホバーオーバーレイ */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute inset-0 flex items-center justify-center
                     rounded-full bg-black/40 opacity-0 group-hover:opacity-100
                     transition-opacity duration-150 cursor-pointer"
          aria-label="画像を変更"
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="プロフィール画像を選択"
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1" />アップロード中</>
          ) : (
            '画像を変更'
          )}
        </Button>
        {currentAvatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">JPEG / PNG / WebP、1MB以下</p>
    </div>
  )
}
```

### 5-3. 活動サマリーコンポーネント

```typescript
// src/components/profile/activity-stats.tsx

interface ActivityStatsProps {
  totalConsultations: number
  totalReplies: number
  totalReactionsReceived: number
}

export function ActivityStats({
  totalConsultations,
  totalReplies,
  totalReactionsReceived,
}: ActivityStatsProps) {
  const stats = [
    { label: '相談', value: totalConsultations },
    { label: '回答', value: totalReplies },
    { label: '共感', value: totalReactionsReceived },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center p-3 rounded-lg bg-muted/50"
        >
          <span className="text-2xl font-bold text-foreground">
            {value.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}
```

---

## 6. サーバーサイド実装

### 6-1. アバターアップロード API

```typescript
// src/app/api/users/me/avatar/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import sharp from 'sharp'

export const runtime = 'edge'  // CF Workers 互換

// ⚠️ sharp は CF Workers 上で動作しないため、
// 画像リサイズは Supabase Edge Function に委譲するか、
// クライアントサイドで canvas を使ってリサイズする（後述の代替案参照）

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })
  }

  // バリデーション
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'JPEG、PNG、WebP 形式のみ対応しています' },
      { status: 400 }
    )
  }
  if (file.size > 1 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'ファイルサイズは 1MB 以下にしてください' },
      { status: 400 }
    )
  }

  // ファイルを ArrayBuffer として取得
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Storage にアップロード（パス: avatars/{user_id}/avatar.webp）
  const filePath = `${user.id}/avatar.webp`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, buffer, {
      contentType: 'image/webp',
      upsert: true,  // 既存ファイルを上書き
      cacheControl: '3600',
    })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return NextResponse.json(
      { error: 'アップロードに失敗しました' },
      { status: 500 }
    )
  }

  // 公開 URL を取得
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  // キャッシュバスティング用にタイムスタンプを付与
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  // profiles テーブル更新
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'プロフィールの更新に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ avatar_url: avatarUrl })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // Storage から削除
  const { error: deleteError } = await supabase.storage
    .from('avatars')
    .remove([`${user.id}/avatar.webp`])

  if (deleteError) {
    console.error('Delete error:', deleteError)
  }

  // profiles テーブル更新
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'プロフィールの更新に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: 'Avatar deleted' })
}
```

### 6-2. 画像リサイズ — CF Workers 対応の代替案

```
⚠️ 重要: sharp は Node.js ネイティブモジュールのため CF Workers で動作しません。
以下のいずれかの方法でリサイズを実装してください。
```

```typescript
// 方法A（推奨）: クライアントサイドで Canvas リサイズ
// src/lib/utils/resize-image.ts

export async function resizeImage(
  file: File,
  maxSize: number = 200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      // 正方形クロップ（中央切り取り）
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2

      canvas.width = maxSize
      canvas.height = maxSize
      ctx!.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/webp',
        0.85  // 品質 85%
      )
    }

    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    img.src = URL.createObjectURL(file)
  })
}

// 使用箇所（avatar-upload.tsx の handleFileSelect 内）:
// const resizedBlob = await resizeImage(file, 200)
// const resizedFile = new File([resizedBlob], 'avatar.webp', { type: 'image/webp' })
// formData.append('file', resizedFile)
```

```typescript
// 方法B: Cloudflare Images（有料、$5/月〜）
// Cloudflare Images の Resize API を使う場合

// wrangler.toml に追加:
// [images]
// binding = "IMAGES"

// サーバーサイドでリサイズ:
// const resized = await env.IMAGES.resize(buffer, {
//   width: 200, height: 200, fit: 'cover', format: 'webp'
// })
```

### 6-3. 公開プロフィール API

```typescript
// src/app/api/users/[nickname]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { nickname: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { nickname } = params

  // プロフィール取得
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      nickname,
      avatar_url,
      headline,
      bio,
      prefecture,
      years_of_experience,
      experience_phases,
      role,
      is_profile_public,
      created_at
    `)
    .eq('nickname', nickname)
    .single()

  if (error || !profile) {
    return NextResponse.json(
      { error: 'プロフィールが見つかりません' },
      { status: 404 }
    )
  }

  // 非公開チェック（相談者 or 非公開設定の回答者）
  if (profile.role === 'consulter' || !profile.is_profile_public) {
    // 管理者は閲覧可能
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (myProfile?.role !== 'admin' && myProfile?.role !== 'moderator') {
        return NextResponse.json(
          { error: 'プロフィールが見つかりません' },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'プロフィールが見つかりません' },
        { status: 404 }
      )
    }
  }

  // 活動統計を集計
  const { data: profile_with_user } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('nickname', nickname)
    .single()

  const userId = profile_with_user?.user_id

  const [repliesResult, reactionsResult] = await Promise.all([
    supabase
      .from('replies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'published'),
    supabase
      .from('reactions')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'reply')
      .in('target_id',
        supabase
          .from('replies')
          .select('id')
          .eq('user_id', userId)
      ),
  ])

  return NextResponse.json({
    nickname: profile.nickname,
    avatar_url: profile.avatar_url,
    headline: profile.headline,
    bio: profile.bio,
    prefecture: profile.prefecture,
    years_of_experience: profile.years_of_experience,
    experience_phases: profile.experience_phases,
    role: profile.role,
    stats: {
      total_replies: repliesResult.count || 0,
      total_reactions_received: reactionsResult.count || 0,
      member_since: profile.created_at,
    },
  })
}
```

---

## 7. ディレクトリ構成（追加分）

```
src/
├── app/
│   ├── (protected)/
│   │   └── mypage/
│   │       ├── page.tsx              # マイページ本体
│   │       ├── loading.tsx           # スケルトン
│   │       └── edit/
│   │           └── page.tsx          # プロフィール編集（フルページ版）
│   └── (public)/
│       └── users/
│           └── [nickname]/
│               ├── page.tsx          # 公開プロフィール
│               └── loading.tsx       # スケルトン
├── components/
│   ├── ui/
│   │   └── user-avatar.tsx           # 共通アバターコンポーネント
│   └── profile/
│       ├── avatar-upload.tsx          # アバターアップロード
│       ├── activity-stats.tsx         # 活動統計
│       ├── profile-form.tsx           # プロフィール編集フォーム
│       ├── activity-history.tsx       # 相談/回答履歴タブ
│       └── public-profile-card.tsx    # 公開プロフ用カード
├── lib/
│   └── utils/
│       └── resize-image.ts            # クライアント画像リサイズ
└── app/
    └── api/
        └── users/
            ├── me/
            │   └── avatar/
            │       └── route.ts       # アバター CRUD
            └── [nickname]/
                └── route.ts           # 公開プロフィール取得
```

---

## 8. 都道府県マスタデータ

```typescript
// src/lib/constants/prefectures.ts

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const

export type Prefecture = typeof PREFECTURES[number]
```

---

## 9. Cursor 実行プロンプト（フェーズ別）

### Phase 1: DB マイグレーション + Storage セットアップ

```
Cursorプロンプト:

1. Supabase ダッシュボードで以下を実行:
   - profiles テーブルに新カラムを追加（Section 2-1 の SQL）
   - avatars バケットを作成（Section 2-2）
   - Storage RLS ポリシーを設定（Section 2-3）

2. TypeScript の Database 型定義を更新:
   - supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
   - profiles テーブルに avatar_url, headline, prefecture,
     years_of_experience, is_profile_public, website_url が含まれることを確認
```

### Phase 2: 共通コンポーネント作成

```
Cursorプロンプト:

1. src/components/ui/user-avatar.tsx を作成（Section 5-1 のコード）
   - shadcn/ui の Avatar コンポーネントをベースに
   - sm/md/lg/xl の 4 サイズ対応
   - フォールバック: ニックネーム頭文字 + 決定論的な背景色

2. 既存コードでユーザー名だけ表示している箇所をすべて検索し、
   UserAvatar + ニックネームの組み合わせに置き換え:
   - ヘッダーのログイン後表示
   - 相談カード（一覧）
   - 相談詳細の投稿者表示
   - 返信の投稿者表示
```

### Phase 3: アバターアップロード機能

```
Cursorプロンプト:

1. src/lib/utils/resize-image.ts を作成（Section 6-2 方法A のコード）
   - Canvas API で 200x200 正方形クロップ
   - WebP 変換（品質 85%）

2. src/components/profile/avatar-upload.tsx を作成（Section 5-2 のコード）
   - ファイル選択 → クライアントリサイズ → API 送信
   - ローディング・エラー状態管理
   - 削除ボタン

3. src/app/api/users/me/avatar/route.ts を作成（Section 6-1 のコード）
   - POST: Supabase Storage にアップロード + profiles 更新
   - DELETE: Storage から削除 + profiles.avatar_url を null に

4. テスト:
   - 1MB超の画像をアップロード → エラー表示
   - PNG/JPEG/WebP → 正常アップロード
   - GIF → エラー表示
   - アップロード後にヘッダー・マイページでアバターが表示される
```

### Phase 4: マイページリニューアル

```
Cursorプロンプト:

1. src/app/(protected)/mypage/page.tsx を以下の構成でリニューアル:
   - アバター（xl サイズ） + ニックネーム + headline + 基本情報
   - 活動サマリー（相談数・回答数・共感数）
   - 活動履歴タブ（自分の相談 / 自分の回答）
   - 設定リンク（通知・ロール変更・退会）

2. src/components/profile/profile-form.tsx を作成:
   - AvatarUpload コンポーネント組み込み
   - ニックネーム、headline、bio、都道府県、経験年数、
     経験フェーズ、ウェブサイト、公開設定
   - バリデーション: ニックネーム 2-20文字、headline 60文字、bio 500文字
   - 送信中のローディング状態
   - PATCH /api/users/me に送信

3. src/components/profile/activity-stats.tsx を作成（Section 5-3 のコード）

4. src/components/profile/activity-history.tsx を作成:
   - 「自分の相談」「自分の回答」のタブ切替
   - 各項目: フェーズタグ + タイトル/本文抜粋 + 日付
   - 5件ずつ表示 + 「もっと見る」
```

### Phase 5: 公開プロフィール

```
Cursorプロンプト:

1. src/app/(public)/users/[nickname]/page.tsx を作成（Section 4-4 のUI）
   - 回答者で is_profile_public = true のユーザーのみ表示
   - それ以外は 404

2. src/app/api/users/[nickname]/route.ts を作成（Section 6-3 のコード）
   - 活動統計の集計
   - アクセス制御（非公開ユーザーへのアクセス拒否）

3. 相談詳細ページの回答者ニックネームをリンク化:
   - アバターまたはニックネームをクリック → /users/:nickname に遷移
   - is_profile_public = false の場合はリンクにしない（テキストのまま）

4. loading.tsx をスケルトンで作成
```

---

## 10. セキュリティ考慮事項

| リスク | 対策 |
|--------|------|
| 悪意のある画像アップロード（偽装 MIME） | サーバーサイドで magic bytes を検証。`file.type` だけに依存しない |
| 巨大画像による DoS | クライアント: 1MB チェック、サーバー: `file.size` 再チェック、Supabase: バケットの `file_size_limit` |
| XSS via SVG | SVG は `allowed_mime_types` に含めない（JPEG/PNG/WebP のみ） |
| プライバシー: EXIF 情報漏洩 | WebP 変換時に EXIF は自動除去される。Canvas リサイズでも EXIF は保持されない |
| プロフィール情報のスクレイピング | `is_profile_public = false` で非公開。レート制限を `/api/users/:nickname` にも適用 |
| ニックネーム変更によるリンク切れ | 公開プロフ URL は `/users/:nickname` で、ニックネーム変更時にURLも変わる。旧URLは404。将来的にUUIDベースに変更可 |
| website_url に javascript: スキーム | サーバーサイドで `https://` or `http://` 始まりのみ許可。バリデーション必須 |

---

## 11. 既存ファイルへの影響

| ファイル | 変更内容 |
|---------|---------|
| `profiles` テーブル | 6カラム追加（Section 2-1） |
| `PATCH /api/users/me` | 新フィールドの受け入れ追加 |
| ヘッダーコンポーネント | ニックネーム → UserAvatar + ニックネーム |
| 相談カード（一覧） | 投稿者名 → UserAvatar + 投稿者名 |
| 相談詳細ページ | 投稿者・回答者に UserAvatar 追加 |
| 返信コンポーネント | 回答者名 → UserAvatar + 回答者名（リンク付き） |
| マイページ | 全面リニューアル |
| Database 型定義 | `supabase gen types` で再生成 |
