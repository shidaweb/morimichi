# もりみち 残タスク — Cursor 実装指示書

> **2026年3月29日時点**: コードベースを精査した結果、ほとんどの機能は実装済み。
> **残りは以下の3点のみ。** この文書を Cursor に渡して実装してください。

---

## 実装状況サマリー

| 機能 | ステータス |
|------|---------|
| プロフィール拡張（アバター・マイページ・公開プロフ） | ✅ 実装済み |
| 回答者プロフィール閲覧導線 | ✅ 実装済み |
| 運営経由の回答者紹介（全回答者対応） | ✅ 実装済み |
| DM防止策（3段階） | ✅ 実装済み |
| 公認再生プロ（申請・審査・バッジ・一覧） | ✅ 実装済み |
| **コラム記事内の画像アップロード** | **❌ 未実装** |
| **SNS共有ボタン** | **❌ 未実装** |
| **OGPメタタグ** | **⚠️ 部分的** |
| リアクション（自己共感防止・トグル） | ✅ 実装済み |
| メール送信（全17ポイント） | ✅ 実装済み |
| HTMLサニタイズ | ✅ 実装済み（react-markdown + rehype-sanitize） |
| 相談一覧キーワード検索 | ✅ 実装済み |
| CSS transition修正・UI安定化 | ✅ 実装済み |

---

## Task 1: コラム記事内の画像アップロード

### 現状

`src/app/(main)/articles/new/page.tsx` は textarea によるマークダウン編集のみ。
記事本文に画像を挿入する手段がない。

### 実装指示

```
Cursorプロンプト:

コラム記事に画像アップロード機能を追加してください。
Tiptap への全面移行は行わず、既存のマークダウンエディタに画像挿入を追加する方針で進めます。

1. Supabase Storage に article-images バケットを作成（まだ無い場合）:

   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   VALUES ('article-images', 'article-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
   ON CONFLICT (id) DO NOTHING;

   -- RLS: 公認プロのみアップロード、閲覧は全員、削除は本人のみ
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

2. API: POST /api/articles/images を新規作成

   ファイル: src/app/api/articles/images/route.ts

   - multipart/form-data でファイル受付
   - 公認プロのみ（is_certified_pro チェック）
   - クライアント側で最大幅 800px にリサイズ済みの WebP を受け取る
   - パス: article-images/{user_id}/{uuid}.webp
   - レスポンス: { "url": "https://...supabase.co/storage/v1/object/public/article-images/..." }
   - magic bytes バリデーション（既存の validate-image-magic-bytes.ts を流用）

3. クライアント側リサイズユーティリティ:

   既存の src/lib/utils/resize-image.ts を流用または拡張。
   記事用は最大幅 800px（アバターは 200x200 正方形だったが、記事画像はアスペクト比維持）。

   export async function resizeArticleImage(file: File): Promise<Blob> {
     return new Promise((resolve, reject) => {
       const img = new Image()
       img.onload = () => {
         const MAX_WIDTH = 800
         let w = img.width, h = img.height
         if (w > MAX_WIDTH) {
           h = Math.round(h * (MAX_WIDTH / w))
           w = MAX_WIDTH
         }
         const canvas = document.createElement('canvas')
         canvas.width = w
         canvas.height = h
         const ctx = canvas.getContext('2d')!
         ctx.drawImage(img, 0, 0, w, h)
         canvas.toBlob(
           (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
           'image/webp', 0.85
         )
       }
       img.onerror = reject
       img.src = URL.createObjectURL(file)
     })
   }

4. エディタUI修正 — src/app/(main)/articles/new/page.tsx:

   textarea の上にツールバーを追加:
   [📷 画像を挿入]

   クリック → ファイル選択ダイアログ → resizeArticleImage → POST /api/articles/images
   → レスポンスの URL を本文に ![画像](url) 形式で挿入

   ドラッグ&ドロップにも対応:
   textarea の onDrop イベントで同じフローを実行。
   アップロード中は「アップロード中...」のプレースホルダーを挿入し、完了後に置換。

5. 編集ページにも同様に適用:
   src/app/(main)/articles/[id]/edit/page.tsx にも同じ画像挿入UIを追加。
```

### テスト

```
- [ ] 「画像を挿入」ボタンをクリックしてファイルを選択 → 本文に ![画像](url) が挿入される
- [ ] ドラッグ&ドロップで画像を textarea に落とす → 同上
- [ ] プレビュータブで画像が表示される
- [ ] 5MB 超のファイルを選択 → エラー表示
- [ ] 非公認プロユーザーには画像挿入ボタンが表示されない
- [ ] 公開された記事で画像が正しく表示される
```

---

## Task 2: SNS共有ボタン

### 現状

`src/app/(main)/articles/[id]/page.tsx` に共有ボタンがない。

### 実装指示

```
Cursorプロンプト:

コラム記事詳細ページ（src/app/(main)/articles/[id]/page.tsx）に
SNS共有ボタンを追加してください。

1. コンポーネント作成: src/components/articles/share-buttons.tsx

   "use client";

   import { useState } from "react";
   import { Share2, Copy, Check } from "lucide-react";
   import { Button } from "@/components/ui/button";

   interface ShareButtonsProps {
     url: string;
     title: string;
   }

   export function ShareButtons({ url, title }: ShareButtonsProps) {
     const [copied, setCopied] = useState(false);

     const encodedUrl = encodeURIComponent(url);
     const encodedTitle = encodeURIComponent(title);

     const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
     const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`;
     const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

     async function copyLink() {
       await navigator.clipboard.writeText(url);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     }

     return (
       <div className="space-y-3">
         <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
           <Share2 className="h-4 w-4" />
           共有する
         </div>
         <div className="flex flex-wrap gap-2">
           <a
             href={twitterUrl}
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
           >
             𝕏 ポスト
           </a>
           <a
             href={lineUrl}
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
           >
             LINE で送る
           </a>
           <a
             href={facebookUrl}
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
           >
             Facebook
           </a>
           <Button
             variant="outline"
             size="sm"
             onClick={copyLink}
             className="gap-1.5"
           >
             {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
             {copied ? "コピーしました" : "リンクをコピー"}
           </Button>
         </div>
       </div>
     );
   }

2. 記事詳細ページに配置:

   src/app/(main)/articles/[id]/page.tsx のタグ表示セクションの後、
   「著者に相談する」セクションの前に追加:

   import { ShareButtons } from "@/components/articles/share-buttons";

   <ShareButtons
     url={`https://morimichi.cc/articles/${article.id}`}
     title={article.title}
   />
```

### テスト

```
- [ ] 記事詳細ページに共有ボタンが表示される
- [ ] 「𝕏 ポスト」→ 新しいタブで Twitter の投稿画面が開く（タイトルとURLがプリセット）
- [ ] 「LINE で送る」→ LINE の共有画面が開く
- [ ] 「Facebook」→ Facebook の共有画面が開く
- [ ] 「リンクをコピー」→ クリップボードにURLがコピーされ、ボタンが「コピーしました」に変わる
- [ ] モバイルでもボタンが正しくレイアウトされる
```

---

## Task 3: OGPメタタグ

### 現状

`src/app/(main)/articles/[id]/page.tsx` は Server Component だが `generateMetadata` がない。
SNS でシェアした時に記事のタイトル・概要・画像が表示されない。

### 実装指示

```
Cursorプロンプト:

コラム記事詳細ページに OGP メタタグを追加してください。

1. src/app/(main)/articles/[id]/page.tsx に generateMetadata を追加:

   import type { Metadata } from "next";
   import { createServerSupabaseClient } from "@/lib/supabase/server";

   export async function generateMetadata({ params }: Props): Promise<Metadata> {
     const { id } = await params;

     let supabase;
     try {
       supabase = await createServerSupabaseClient();
     } catch {
       return { title: "コラム | もりみち" };
     }

     // 軽量クエリ（記事の基本情報のみ）
     const { data: article } = await supabase
       .from("articles")
       .select("title, summary, body, cover_image_url, published_at, author_user_id, profiles!inner(nickname)")
       .eq("id", id)
       .eq("status", "published")
       .single();

     if (!article) {
       return { title: "コラム | もりみち" };
     }

     const description = article.summary || article.body.replace(/[#*_\[\]()]/g, "").slice(0, 120);
     const authorName = (article.profiles as any)?.nickname || "もりみち";

     return {
       title: `${article.title} | もりみち`,
       description,
       openGraph: {
         title: article.title,
         description,
         url: `https://morimichi.cc/articles/${id}`,
         siteName: "もりみち — 早期事業再生コミュニティ",
         type: "article",
         publishedTime: article.published_at ?? undefined,
         authors: [authorName],
         images: article.cover_image_url
           ? [{ url: article.cover_image_url, width: 1200, height: 630 }]
           : [{ url: "https://morimichi.cc/og-default.png", width: 1200, height: 630 }],
         locale: "ja_JP",
       },
       twitter: {
         card: "summary_large_image",
         title: article.title,
         description,
         images: article.cover_image_url
           ? [article.cover_image_url]
           : ["https://morimichi.cc/og-default.png"],
       },
     };
   }

2. デフォルトOG画像を作成:

   public/og-default.png を作成してください。
   - サイズ: 1200×630px
   - 内容: もりみちのロゴ（🌲 もりみち）+ 「早期事業再生コミュニティ」テキスト
   - 背景: サイトのプライマリカラー（緑系）にグラデーション
   - シンプルで清潔感のあるデザイン

   ※ Canvas API や SVG でプログラム生成するか、
     または簡易的にプレースホルダーを作成してください。

3. サイト全体のデフォルト OGP も設定:

   src/app/layout.tsx の metadata を確認し、以下が設定されているか確認:

   export const metadata: Metadata = {
     title: {
       default: "もりみち — 早期事業再生コミュニティ",
       template: "%s | もりみち",
     },
     description: "経営がしんどい時、匿名で相談できる場所。経験者・専門家が回答します。",
     metadataBase: new URL("https://morimichi.cc"),
     openGraph: {
       siteName: "もりみち",
       locale: "ja_JP",
       type: "website",
       images: [{ url: "/og-default.png", width: 1200, height: 630 }],
     },
     twitter: {
       card: "summary_large_image",
     },
   };
```

### テスト

```
- [ ] /articles/:id のHTML <head> に og:title, og:description, og:image が含まれる
- [ ] og:image がカバー画像のURL（カバー画像がある場合）
- [ ] og:image が /og-default.png（カバー画像がない場合）
- [ ] Twitter Card Validator (cards-dev.twitter.com) で正しくプレビューされる
- [ ] Facebook Sharing Debugger (developers.facebook.com/tools/debug/) で正しくプレビューされる
- [ ] サイトトップの OGP も設定されている
```

---

## 実装順序

```
Task 1（画像アップロード）→ Task 3（OGP）→ Task 2（共有ボタン）

理由:
- 画像アップロードが先にないと cover_image_url が設定できず OGP テストが不完全
- OGP が先にないと SNS 共有ボタンで共有しても正しく表示されない
```

---

*version: 1.0 | 作成日: 2026年3月29日*
*コードベース精査日: 2026年3月29日*
