# もりみち 未実装・検討不足領域の補完 — Cursor 実装指示書

> **この文書の使い方**: 既存のMD群（v3仕様書・Cursor実装ガイド・プロフィール拡張・公認再生プロ・QAガイド・メールQA）を
> 基本コンセプトに照らし合わせてギャップ分析した結果です。**検出された問題を優先度順に修正してください。**

---

## 0. 基本コンセプト（判定基準）

| # | コンセプト | 判定 |
|---|-----------|------|
| 1 | 相談ができる | ✅ 実装済み |
| 2 | 回答ができる | ✅ 実装済み |
| 3 | 相談者も回答者も、回答に対してリアクションや返信ができる | ⚠️ 部分的（後述） |
| 4 | DMはできない | ⚠️ 機能はないが**防止策が未設計** |
| 5 | 相談者が気になれば、運営を通じて回答者の紹介を依頼できる | ❌ **公認プロ以外に対応していない** |
| 6 | 相談者も回答者も、プロフィールを閲覧できる | ❌ **相談者→回答者の導線が未設計** |
| 7 | 公認再生プロ（バッジ・コラム） | ✅ 設計済み |
| 8 | コラム（H1-H5 MD・画像・Note風・SNS共有） | ⚠️ **画像アップロード・SNS共有・リッチエディタが未設計** |

---

## 1. 🔴 CRITICAL-A: 運営経由の回答者紹介が公認プロ限定になっている

### 問題

`certified_pro_guide.md` の `contact_requests` テーブルと「運営を通じてこの人に相談する」ボタンは、**公認再生プロ（is_certified_pro = true）の画面にしか配置されていない**。

しかし基本コンセプトでは「相談者が気になれば、**回答者**の紹介を依頼できる」であり、公認プロでない一般の回答者にも紹介リクエストが送れなければならない。

### 現状の設計漏れ

- `contact_requests` テーブル自体は `target_pro_user_id` という名前で公認プロ前提
- 「運営を通じて相談する」ボタンは公認プロ一覧と公認プロのコラム詳細にしか配置されていない
- 一般回答者の返信に紹介依頼の導線がない
- 相談詳細ページで「この回答者について聞いてみる」動線がない

### 修正指示

```
Cursorプロンプト:

1. DB修正 — contact_requests テーブルのカラム名を汎用化:

   ALTER TABLE public.contact_requests
     RENAME COLUMN target_pro_user_id TO target_user_id;

   -- target_user_id は公認再生プロでなくても良い
   -- ただし role が advisor / both / admin のユーザーのみ（相談者同士はNG）

2. RLS修正 — target_user_id の制約を変更:

   -- 旧: target が公認再生プロであること
   -- 新: target が回答者ロール（advisor/both）であること
   CREATE POLICY "Target must be advisor role"
     ON contact_requests FOR INSERT
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM profiles
         WHERE profiles.user_id = target_user_id
         AND profiles.role IN ('advisor', 'both', 'admin')
       )
     );

3. UI修正 — 以下の3箇所に「運営を通じて相談する」ボタンを追加:

   a) 相談詳細ページの各回答（depth=1の返信）に:
      回答者名の横に [運営を通じてこの人に相談する] リンクを追加
      ※ 回答者の is_profile_public に関係なく表示
      ※ 未ログイン時はログイン誘導
      ※ 相談者自身の回答にはボタンを出さない

   b) 回答者の公開プロフィールページ（/users/:nickname）に:
      既存の公認プロ用と同じボタンを配置

   c) 公認再生プロ一覧ページ:
      既存のまま（変更なし）

4. API修正 — POST /api/contact-requests:
   - target_pro_user_id → target_user_id に変更
   - 公認プロチェックを削除し、advisor/both/admin ロールチェックに変更
   - メール送信先は変わらず master@jugyoin.jp

5. メールテンプレート修正:
   - contact-request.ts の「宛先プロ」表記を
     is_certified_pro の場合: 「宛先プロ: {nickname}（{specialty}）」
     そうでない場合: 「宛先回答者: {nickname}」
     に分岐
```

### テストケース追加

```
| ID | テストケース | 期待結果 |
|----|------------|---------|
| INTRO-001 | 相談者が一般回答者（非プロ）に紹介リクエストを送信 | 送信成功、master@jugyoin.jp にメール |
| INTRO-002 | 相談者が公認再生プロに紹介リクエストを送信 | 送信成功（既存と同じ） |
| INTRO-003 | 回答者が別の回答者に紹介リクエストを送信 | 送信成功（回答者同士も可能） |
| INTRO-004 | 相談者が別の相談者に紹介リクエストを送信 | ❌ RLS で拒否（回答者ロールではない） |
| INTRO-005 | 未ログインユーザーが紹介リクエストを送信 | ❌ 401（ログイン必要） |
| INTRO-006 | 自分自身に紹介リクエストを送信 | ❌ バリデーションで拒否 |
| INTRO-007 | 相談詳細ページの回答者名横にボタンが表示される | ✅ advisor/both ロールの回答にのみ表示 |
```

---

## 2. 🔴 CRITICAL-B: 相談者から回答者のプロフィールが閲覧できない

### 問題

`profile_enhancement_guide.md` の公開プロフィール API（`GET /api/users/:nickname`）は以下のロジックになっている:

```typescript
// 現状のコード（profile_enhancement_guide.md Section 6-3）
if (profile.role === 'consulter' || !profile.is_profile_public) {
  return 404  // ← 相談者のプロフは非公開（正しい）
}
```

これ自体は正しいが、問題は **回答者が `is_profile_public = false`（デフォルト）のまま** だと、相談詳細ページで回答している回答者のプロフィールを誰も見られないこと。

相談者がスレッドで回答を読み「この人はどんな人だろう」と思った時に、プロフィールに飛べる導線がない。

### 現状の設計漏れ

- 回答者プロフィールのデフォルトが `is_profile_public = false`
- スレッド内の回答者名がクリッカブルではない
- 回答者一覧/検索ページが存在しない
- 「公開プロフィール」は回答者が自発的にONにしないと見えない
- 相談者は「この回答してくれた人の背景を知りたい」が満たせない

### 修正指示

```
Cursorプロンプト:

以下の方針で修正してください。
「プロフィール全文公開」と「最低限の情報表示」を分離します。

1. 概念の分離:
   - is_profile_public = true → フル公開プロフィール（bio、都道府県、経験年数、ウェブサイト含む）
   - is_profile_public = false → 最低限プロフィール（ニックネーム、アバター、経験フェーズ、活動統計のみ）

2. API修正 — GET /api/users/:nickname:

   公開設定に関わらず、advisor/both ロールの以下の情報は常に返す:
   {
     "nickname": "経験者A",
     "avatar_url": "...",
     "experience_phases": ["資金繰り", "破産"],
     "is_certified_pro": true/false,
     "pro_specialty": {...} | null,
     "stats": {
       "total_replies": 42,
       "total_reactions_received": 128,
       "member_since": "2026-01-15"
     }
   }

   is_profile_public = true の場合のみ追加で返す:
   {
     "headline": "...",
     "bio": "...",
     "prefecture": "...",
     "years_of_experience": 15,
     "website_url": "..."
   }

   consulter ロールのプロフィールは引き続き 404（相談者は匿名を守る）。

3. UI修正 — 相談詳細ページの回答者名:
   - 回答者のニックネームを Link に変更: /users/:nickname
   - アバターもクリッカブルに

4. UI修正 — /users/:nickname ページ:
   - is_profile_public = true: フル情報を表示
   - is_profile_public = false: 最低限情報 + 「このユーザーは詳細プロフィールを公開していません」

5. 両方のケースで:
   - 「運営を通じてこの人に相談する」ボタンを表示（CRITICAL-Aの修正と連動）
   - 公認再生プロの場合はバッジ + コラム一覧も表示

6. デフォルト値の変更を検討:
   回答者登録時に「プロフィールを公開しますか？」の選択肢を表示し、
   デフォルトを true に変更することを推奨。
   ただし既存ユーザーのデフォルトは false のまま維持。
```

### テストケース追加

```
| ID | テストケース | 期待結果 |
|----|------------|---------|
| PROF-001 | 相談者が回答者（is_profile_public=true）のプロフを閲覧 | フル情報が見える |
| PROF-002 | 相談者が回答者（is_profile_public=false）のプロフを閲覧 | 最低限情報のみ + 「詳細非公開」表示 |
| PROF-003 | 相談者が別の相談者のプロフを閲覧 | 404（相談者同士は見えない） |
| PROF-004 | 未ログインユーザーが回答者プロフを閲覧 | 最低限情報は見える |
| PROF-005 | 相談詳細ページの回答者名がリンクになっている | クリックで /users/:nickname に遷移 |
| PROF-006 | 回答者が自分のプロフ公開設定をOFFにしても最低限情報は表示される | 最低限情報は常に見える |
```

---

## 3. 🟡 HIGH-A: コラムエディタの画像アップロード・Note風UI・SNS共有が未設計

### 問題

`certified_pro_guide.md` のコラム記事機能は「マークダウンに対応」「タブでプレビュー」としか書かれていない。基本コンセプトで求められている「H1-H5のMD形式で、画像の掲載、Noteに近い形でコラムを記載し、SNSで共有できる」が大幅に欠落している。

### 欠落している要素

| 要素 | 現状 | あるべき姿 |
|------|------|-----------|
| H1-H5 見出し | react-markdown で暗黙的に対応 | ツールバーから見出しレベルを選択できる |
| 画像掲載 | ❌ 完全に未設計 | 記事内に画像をアップロード・配置できる |
| Note風エディタ | ❌ textarea + プレビュー のみ | リッチテキストツールバー + リアルタイムプレビュー |
| SNS共有 | ❌ 完全に未設計 | Twitter/LINE/Facebook シェアボタン + OGP |

### 修正指示

```
Cursorプロンプト:

コラム記事エディタを Note（note.com）に近い体験にリニューアルしてください。
```

#### 3-1. リッチエディタの導入

```
Cursorプロンプト:

1. Tiptap エディタを導入:
   pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image
   pnpm add @tiptap/extension-heading @tiptap/extension-link
   pnpm add @tiptap/extension-placeholder @tiptap/extension-character-count

2. src/components/articles/article-editor.tsx を以下のUIで作成:

   ┌──────────────────────────────────────────────────────┐
   │  コラムを書く                                         │
   ├──────────────────────────────────────────────────────┤
   │                                                        │
   │  タイトル（100文字以下）                               │
   │  ┌──────────────────────────────────────┐              │
   │  │ 銀行との交渉で大切な3つのこと         │              │
   │  └──────────────────────────────────────┘              │
   │                                                        │
   │  ┌──────────────────────────────────────┐              │
   │  │ [H1][H2][H3][H4][H5] [B][I] [🔗]    │              │
   │  │ [📷画像] [—引用] [•リスト] [1.番号]   │              │
   │  ├──────────────────────────────────────┤              │
   │  │                                        │              │
   │  │  ここに本文を書いてください...          │              │
   │  │                                        │              │
   │  │  （Tiptap WYSIWYG エディタ）           │              │
   │  │                                        │              │
   │  │  見出し、太字、リンク、引用、リスト、    │              │
   │  │  画像が使えます。                       │              │
   │  │                                        │              │
   │  └──────────────────────────────────────┘              │
   │  0 / 10,000文字                                        │
   │                                                        │
   │  タグ（最大5つ）                                       │
   │  [資金繰り ✕] [銀行交渉 ✕] [+ タグを追加]             │
   │                                                        │
   │  [下書き保存]           [公開する]                     │
   │                                                        │
   └──────────────────────────────────────────────────────┘

3. エディタの出力はHTML（Tiptapのデフォルト）とし、
   表示側は dangerouslySetInnerHTML + DOMPurify でサニタイズ。
   マークダウンへの変換は不要（Tiptapは内部的にProseMirrorのHTMLを使う）。

4. ただしAPIの articles.body カラムには HTML を保存する。
   既存設計がマークダウン前提だった場合、HTML保存に変更。
```

#### 3-2. 記事内画像アップロード

```
Cursorプロンプト:

1. Supabase Storage に article-images バケットを作成:

   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   VALUES (
     'article-images',
     'article-images',
     true,
     5242880,  -- 5MB上限
     ARRAY['image/jpeg', 'image/png', 'image/webp']
   );

2. Storage RLS:
   - 公認再生プロのみアップロード可能
   - 閲覧は誰でも可能
   - 自分の画像のみ削除可能

   CREATE POLICY "Certified pros can upload article images"
     ON storage.objects FOR INSERT
     WITH CHECK (
       bucket_id = 'article-images'
       AND EXISTS (
         SELECT 1 FROM profiles
         WHERE profiles.user_id = auth.uid()
         AND profiles.is_certified_pro = true
       )
     );

   CREATE POLICY "Public article image access"
     ON storage.objects FOR SELECT
     USING (bucket_id = 'article-images');

3. API: POST /api/articles/images
   - multipart/form-data でファイル受付
   - パス: article-images/{user_id}/{uuid}.webp
   - クライアントリサイズ: 最大幅 800px、WebP変換
   - レスポンス: { "url": "https://...supabase.co/storage/v1/object/public/article-images/..." }

4. Tiptap エディタの画像ボタン:
   - クリック → ファイル選択ダイアログ
   - 選択 → クライアントリサイズ → API アップロード → エディタに画像挿入
   - ドラッグ&ドロップにも対応
```

#### 3-3. SNS共有機能

```
Cursorプロンプト:

1. 記事詳細ページに共有ボタンを追加:

   ─────── 共有する ───────
   [𝕏 ポスト]  [LINE で送る]  [Facebook]  [🔗 リンクをコピー]

2. 各ボタンの実装:

   // Twitter/X
   const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(articleUrl)}`

   // LINE
   const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(articleUrl)}`

   // Facebook
   const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`

   // リンクコピー
   navigator.clipboard.writeText(articleUrl)
   → トースト「リンクをコピーしました」

3. OGP メタタグの設定（記事詳細ページの generateMetadata）:

   // src/app/(public)/articles/[id]/page.tsx
   export async function generateMetadata({ params }): Promise<Metadata> {
     const article = await getArticle(params.id)
     return {
       title: `${article.title} | もりみち`,
       description: article.summary || article.body.slice(0, 120),
       openGraph: {
         title: article.title,
         description: article.summary || article.body.slice(0, 120),
         url: `https://morimichi.cc/articles/${article.id}`,
         siteName: 'もりみち',
         type: 'article',
         publishedTime: article.published_at,
         authors: [article.author.nickname],
         images: article.cover_image_url
           ? [{ url: article.cover_image_url, width: 1200, height: 630 }]
           : [{ url: 'https://morimichi.cc/og-default.png', width: 1200, height: 630 }],
       },
       twitter: {
         card: 'summary_large_image',
         title: article.title,
         description: article.summary || article.body.slice(0, 120),
       },
     }
   }

4. デフォルトOG画像の作成:
   - もりみちのロゴ + 「公認再生プロのコラム」テキスト
   - 1200×630px の画像を public/og-default.png に配置
```

---

## 4. 🟡 HIGH-B: DM防止の設計が存在しない

### 問題

「DMはできない」はコンセプトに明記されているが、現在の設計には連絡先交換を防止する仕組みがまったくない。投稿や返信にメールアドレス、電話番号、LINE ID などを書けば実質的にDMが成立してしまう。

### 修正指示

```
Cursorプロンプト:

3段階のDM防止策を実装してください。

====== 第1段階: ユーザー教育（UI） ======

1. 相談投稿フォーム・返信フォームの上部に注意書きを表示:

   ⚠️ 個人を特定できる情報（メールアドレス、電話番号、
   SNSアカウント等）の記載は禁止されています。
   発見した場合は運営が非表示にすることがあります。

2. 利用規約に以下を追加:
   「投稿内に連絡先情報（メールアドレス、電話番号、LINE ID、
   SNSアカウント等）を含めることを禁止します。」

====== 第2段階: クライアント側バリデーション ======

3. 投稿・返信の送信前に、本文を以下の正規表現でチェック:

   // src/lib/utils/content-filter.ts

   const CONTACT_PATTERNS = [
     // メールアドレス
     /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
     // 電話番号（日本形式）
     /0\d{1,4}-?\d{1,4}-?\d{3,4}/g,
     /\+81\d{9,10}/g,
     // LINE ID
     /LINE\s*(?:ID|id|Id)\s*[:：]?\s*\S+/gi,
     /(?:ライン|らいん)\s*(?:ID|id|Id)\s*[:：]?\s*\S+/gi,
     // SNS
     /(?:twitter|instagram|facebook|tiktok)\.com\/\S+/gi,
     /@[a-zA-Z0-9_]{3,}(?=\s|$)/g,  // @username形式（注意: 誤検知あり）
   ]

   export function detectContactInfo(text: string): {
     hasContactInfo: boolean
     matches: string[]
   } {
     const matches: string[] = []
     for (const pattern of CONTACT_PATTERNS) {
       const found = text.match(pattern)
       if (found) matches.push(...found)
     }
     return { hasContactInfo: matches.length > 0, matches }
   }

4. 検出時にフォームを送信せず、警告を表示:

   「連絡先情報が含まれている可能性があります。
   個人を特定できる情報の記載は禁止されています。
   内容を修正してから再度お試しください。」

   ※ ユーザーが修正して再送信可能（ブロックではなく警告）

====== 第3段階: サーバー側フラグ + 管理者通知 ======

5. サーバー側でも同じパターンチェックを実行:
   - 検出された場合も投稿は保存する（過剰ブロック防止）
   - ただし content_status を 'published' のまま、
     reports テーブルに自動通報レコードを INSERT
   - master@jugyoin.jp に自動通報メールを送信:
     件名: 【もりみち】連絡先情報検出 — 自動フラグ
     本文: 投稿ID、投稿者、検出パターン

6. 管理画面に「自動フラグ一覧」セクションを追加:
   - 自動検出された投稿の一覧
   - 確認 → 問題なし（解除）/ 問題あり（非表示+警告）
```

### テストケース追加

```
| ID | テストケース | 期待結果 |
|----|------------|---------|
| DM-001 | 返信にメールアドレス（test@example.com）を含めて投稿 | クライアント警告表示 |
| DM-002 | 返信に電話番号（090-1234-5678）を含めて投稿 | クライアント警告表示 |
| DM-003 | 返信に「LINE ID: myid123」を含めて投稿 | クライアント警告表示 |
| DM-004 | 返信に twitter.com/username を含めて投稿 | クライアント警告表示 |
| DM-005 | 警告を無視して送信（API直接叩き） | 投稿は保存されるが自動通報が作成される |
| DM-006 | 「メールアドレスは」という文脈のみ（実際のアドレスなし）| 誤検知しない |
```

---

## 5. 🟡 HIGH-C: 相談者の返信権限とリアクション動作の不明確さ

### 問題

基本コンセプト:「相談者も回答者も、回答に対してリアクションや返信ができる」

権限マトリクス（v3仕様書 line 179）:
```
返信への返信（スレッド内）| ❌ | ✅（自分の相談内のみ）| ✅ | ✅ | ✅ | ✅
```

相談者は「自分の相談内のみ」返信への返信ができる。しかし以下が不明確:

| 疑問 | 回答がない箇所 |
|------|--------------|
| 相談者は他人の相談の回答にリアクション（共感）できるか？ | 権限マトリクスでは共感は「✅」だがスコープが不明 |
| 自分の投稿に自分で共感できるか？ | 未定義 |
| 共感のトグル（取り消し）時のカウント減算は即時か？ | 未定義 |
| depth=2 の返信に返信ボタンが出ないことは明示されているか？ | テストケースなし |
| depth=2 到達時の API 側バリデーションは？ | SQL CHECK 制約なし |

### 修正指示

```
Cursorプロンプト:

1. リアクションの仕様を明確化し実装:

   // 共感の範囲:
   // - 相談者は、すべての相談・返信に共感できる（自分の相談内に限らない）
   // - 回答者も同様
   // - 自分自身の投稿には共感できない（自己共感の防止）

   // RLS修正:
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

2. 共感ボタンのUIを統一:
   - 共感済みの場合: ❤️ 128（赤色、クリックで取り消し）
   - 未共感の場合: 🤍 127（グレー、クリックで共感）
   - 自分の投稿: ボタン非表示 or disabled
   - カウントの増減は楽観的更新（即時UI反映 → API呼び出し）

3. depth=2 制限の強化:

   // DB制約を追加:
   ALTER TABLE replies ADD CONSTRAINT check_reply_depth CHECK (depth <= 2);

   // API側バリデーション:
   // POST /api/consultations/:id/replies
   if (parentReply && parentReply.depth >= 2) {
     return NextResponse.json(
       { error: 'これ以上返信のネストはできません' },
       { status: 400 }
     )
   }

   // UI側: depth=2 の返信に「返信する」ボタンを表示しない
```

### テストケース追加

```
| ID | テストケース | 期待結果 |
|----|------------|---------|
| REACT-001 | 相談者が他人の相談の回答に共感 | ✅ 共感可能 |
| REACT-002 | 回答者が他人の相談の回答に共感 | ✅ 共感可能 |
| REACT-003 | 自分の投稿に共感 | ❌ ボタン非表示 or disabled |
| REACT-004 | 共感 → 取り消し → 再共感 | カウントが 1→0→1 と正しく変動 |
| DEPTH-001 | depth=2 の返信に「返信する」ボタン | 非表示 |
| DEPTH-002 | API で depth=2 の返信に対して返信 POST | 400エラー |
| DEPTH-003 | SQL で depth=3 のレコードを直接INSERT | CHECK制約違反 |
```

---

## 6. 🟠 MEDIUM-A: コラム記事のマークダウンサニタイズ設定が未定義

### 問題

`certified_pro_guide.md` は `rehype-sanitize` を依存に含めているが、許可するHTML要素の設定が書かれていない。Tiptapに移行する場合はDOMPurifyを使うが、いずれにしてもサニタイズの設定が必要。

### 修正指示

```
Cursorプロンプト:

1. DOMPurify を導入:
   pnpm add dompurify @types/dompurify

2. 許可する要素を明示的に定義:

   // src/lib/utils/sanitize-html.ts
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
     'href', 'target', 'rel',          // a タグ
     'src', 'alt', 'width', 'height',  // img タグ
     'class',                           // スタイリング用
   ]

   export function sanitizeArticleHtml(html: string): string {
     return DOMPurify.sanitize(html, {
       ALLOWED_TAGS,
       ALLOWED_ATTR,
       ALLOW_DATA_ATTR: false,
       ADD_ATTR: ['target'],  // リンクを新しいタブで開く
     })
   }

3. 記事保存時（サーバー側）と表示時（クライアント側）の両方でサニタイズ。
```

---

## 7. 🟠 MEDIUM-B: 相談一覧ページの検索機能が未設計

### 問題

相談一覧ページはフェーズ別タブとソート（新着/回答多い/閲覧多い）があるが、**テキスト検索（キーワード検索）がない**。相談数が増えた時に目的の相談を見つけられない。

### 修正指示

```
Cursorプロンプト:

1. 相談一覧ページに検索バーを追加:
   フェーズタブの上に:
   ┌──────────────────────────────────────┐
   │ 🔍 キーワードで相談を検索...           │
   └──────────────────────────────────────┘

2. API修正 — GET /api/consultations にクエリパラメータ追加:
   ?keyword=資金繰り → title, body を ILIKE 検索
   ※ Supabase の textSearch() を使用:
   .textSearch('title_body_search', keyword, { type: 'websearch' })

3. DB修正 — 全文検索用のインデックスを追加:
   ALTER TABLE consultations
     ADD COLUMN title_body_search tsvector
     GENERATED ALWAYS AS (
       to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
     ) STORED;

   CREATE INDEX idx_consultations_search ON consultations USING GIN(title_body_search);

4. 検索結果でマッチした部分をハイライト表示。
```

---

## 8. 優先度別の実装順序

```
Cursorプロンプト:

以下の順序で修正を実施してください。
各フェーズ完了後に動作確認してから次に進んでください。

Phase 1（即日）: CRITICAL-A + CRITICAL-B
  → 運営経由の回答者紹介を全回答者に拡張
  → 相談者から回答者プロフィールの閲覧を可能に

Phase 2（2日）: HIGH-B
  → DM防止の3段階実装（教育UI→クライアント検出→サーバーフラグ）

Phase 3（3日）: HIGH-A
  → コラムエディタをTiptapでリニューアル
  → 記事内画像アップロード
  → SNS共有ボタン + OGP

Phase 4（1日）: HIGH-C
  → リアクション仕様の明確化・自己共感防止
  → depth=2 制限のDB制約・APIバリデーション追加

Phase 5（1日）: MEDIUM-A + MEDIUM-B
  → サニタイズ設定の明示化
  → 相談一覧のキーワード検索
```

---

## 9. 修正後のチェックリスト

### 🔴 CRITICAL（これが通らないとコンセプト未達成）

- [ ] 一般回答者（非プロ）に対して相談リクエストを送信できる
- [ ] 相談詳細ページの回答者名がクリッカブルでプロフィールに遷移できる
- [ ] 回答者の最低限プロフィール（ニックネーム・アバター・経験フェーズ・統計）が誰でも見える
- [ ] 相談者のプロフィールは引き続き非公開（404）

### 🟡 HIGH

- [ ] コラムエディタで H1-H5 見出しをツールバーから挿入できる
- [ ] コラムエディタで画像をアップロード・配置できる
- [ ] コラム記事にSNS共有ボタン（Twitter/LINE/Facebook/リンクコピー）がある
- [ ] コラム記事のOGPメタタグが設定されている
- [ ] 投稿・返信にメールアドレス/電話番号/LINE IDを書くと警告が出る
- [ ] サーバー側で連絡先パターンを検出し自動通報が作成される
- [ ] 自分の投稿に共感ボタンが表示されない or disabled
- [ ] depth=2 の返信に「返信する」ボタンが表示されない
- [ ] depth=2 に対する返信 API が 400 エラーを返す

### 🟠 MEDIUM

- [ ] 記事HTMLがサニタイズされ `<script>` 等が除去される
- [ ] 相談一覧にキーワード検索バーがある
- [ ] 全文検索インデックスが作成されている
