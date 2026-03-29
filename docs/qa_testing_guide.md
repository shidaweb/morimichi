# もりみち QA テストガイド — Cursor 実行用

> **この文書の使い方**: Cursor の AI に渡して、もりみち（morimichi.cc）の品質保証を自動化・体系化するための指示書です。
> `jigyou_saisei_community_MVP_spec_v3.md` と `cursor_implementation_guide.md` と併せて使用してください。

---

## 0. 本番サイト調査で検出された問題

### 🔴 Critical: グローバル `transition: all` 汚染

**現象**: クリック時・ページ遷移時に要素がフワッと動く、ちらつく、色が滑らかに変わりすぎるなど「怪しい動き」が多発。

**原因**: CSS で `transition: all` が `<html>` を含む全要素に継承されている。`<head>`, `<meta>`, `<script>` タグにまで transition が適用されている状態。Tailwind CSS のユーティリティクラスまたはグローバルCSSで意図せず全要素に transition が掛かっている。

**修正指示**:

```
Cursorへの指示:

1. globals.css（または app/layout.tsx の中の globals.css import先）を開く
2. 以下のような記述を探して削除または限定する:
   - `* { transition: all ... }`
   - `html { transition: all ... }`
   - Tailwind の @layer base 内で全要素に transition を付けている記述
3. transition は必要な要素だけに個別適用する:
   - ボタンの hover: `transition-colors duration-150`
   - モーダルの開閉: `transition-opacity duration-200`
   - ドロップダウン: `transition-all duration-150`
4. 修正後、以下を確認:
   - DevTools → Elements → Computed で <html> に transition が無いこと
   - ページ間遷移でちらつきが無いこと
```

### 🟡 Warning: ローディング状態の欠如

**現象**: SPA遷移時に何も表示されず、一瞬空白になる。ユーザーが「壊れた？」と感じる。

**原因**: loading.tsx が未実装。Next.js App Router は `loading.tsx` を配置すると自動で Suspense boundary を作るが、現在どのルートにも存在しない。

**修正指示**:

```
Cursorへの指示:

1. 以下のディレクトリそれぞれに loading.tsx を作成:
   - app/(public)/loading.tsx
   - app/(public)/consultations/loading.tsx
   - app/(public)/consultations/[id]/loading.tsx
   - app/(public)/support/loading.tsx
   - app/(auth)/login/loading.tsx
   - app/(auth)/register/loading.tsx
   - app/(protected)/consultations/new/loading.tsx

2. loading.tsx の共通パターン:
   export default function Loading() {
     return (
       <div className="flex items-center justify-center min-h-[50vh]">
         <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
       </div>
     )
   }

3. コンテンツが多いページにはスケルトンを実装:
   - 相談一覧: カード型スケルトン × 5
   - 相談詳細: タイトル + 本文 + 返信エリアのスケルトン
```

### 🟡 Warning: Next.js Link の prefetch 未活用

**現象**: ナビゲーションリンクに prefetch が設定されていないため、遷移に体感的な遅延がある。

**修正指示**:

```
Cursorへの指示:

1. ヘッダーナビの「相談一覧」「支援リンク」リンクに prefetch を確認
   <Link href="/consultations" prefetch={true}>
2. 一覧ページの各相談カードリンクにも prefetch を付与
3. ただし、認証が必要なページ（/consultations/new 等）には prefetch={false} を設定
```

---

## 1. テストカテゴリ一覧

| # | カテゴリ | 対象 | 優先度 |
|---|---------|------|--------|
| 1 | グローバルCSS/トランジション | 全ページ | 🔴 Critical |
| 2 | ページ遷移・ローディング | SPA ルーティング | 🔴 Critical |
| 3 | 認証フロー | 登録・ログイン・ログアウト・PW リセット | 🔴 Critical |
| 4 | 相談投稿フロー | フェーズ選択 → 困りごと → テキスト → 送信 | 🔴 Critical |
| 5 | スレッド表示・返信 | 3 層スレッド構造 | 🔴 Critical |
| 6 | モーダル/ポップアップ制御 | ダイアログ・ドロップダウン・確認モーダル | 🟡 High |
| 7 | レスポンシブ UI | モバイル / タブレット / デスクトップ | 🟡 High |
| 8 | フォームバリデーション | 全入力フォーム | 🟡 High |
| 9 | 通知・メール | 双方向通知の発火・表示 | 🟡 High |
| 10 | アクセス制御 | ロール別の権限チェック | 🔴 Critical |
| 11 | エッジケース・異常系 | 空データ・大量データ・同時操作 | 🟠 Medium |
| 12 | パフォーマンス | Core Web Vitals・CF Workers 固有 | 🟠 Medium |
| 13 | アクセシビリティ | キーボード操作・スクリーンリーダー | 🟠 Medium |

---

## 2. カテゴリ別テストケース

### 2-1. グローバルCSS/トランジション（🔴 Critical）

```
Cursorへの指示:

以下のテストを Playwright で実装してください。
テストファイル: tests/e2e/css-transitions.spec.ts
```

| ID | テストケース | 期待結果 | 検証方法 |
|----|------------|---------|---------|
| CSS-001 | トップページ表示時、`<html>` に `transition: all` が無い | `transition` が `none` または未設定 | `getComputedStyle(document.documentElement).transition` |
| CSS-002 | ページ遷移時に背景色がアニメーションしない | 即座に切り替わる | 遷移前後のスクリーンショット比較 |
| CSS-003 | ボタン hover 時のみ transition が発生する | hover 時だけ色が滑らかに変化 | `.btn` の computed transition を確認 |
| CSS-004 | ダークモード切替がある場合、色変化が全要素で同時にちらつかない | 瞬時に切替 | ビジュアルリグレッション |
| CSS-005 | フェーズタブ切替時にレイアウトシフトが無い | CLS < 0.1 | Lighthouse CI |

### 2-2. ページ遷移・ローディング（🔴 Critical）

```
Cursorへの指示:

以下のテストを Playwright で実装してください。
テストファイル: tests/e2e/navigation.spec.ts
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| NAV-001 | トップ → 相談一覧への遷移 | 500ms以内に表示、空白フレームなし |
| NAV-002 | 相談一覧 → 相談詳細への遷移 | loading.tsx のスケルトンが先に表示される |
| NAV-003 | 相談詳細 → ブラウザバック | 一覧ページのスクロール位置が保持される |
| NAV-004 | 未認証で /consultations/new にアクセス | /login にリダイレクト、ログイン後に /consultations/new に戻る |
| NAV-005 | 直接URL入力で存在しないページにアクセス | 404ページが表示される（空白にならない） |
| NAV-006 | ネットワーク切断中にリンクをクリック | エラーメッセージが表示される（フリーズしない） |
| NAV-007 | 同じリンクを高速連打（5回） | 重複遷移せず、最終ページが正しく表示 |

### 2-3. 認証フロー（🔴 Critical）

```
Cursorへの指示:

以下のテストを Playwright で実装してください。
テストファイル: tests/e2e/auth.spec.ts
Supabase テスト用のメールアドレスを環境変数 TEST_EMAIL / TEST_PASSWORD で設定。
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| AUTH-001 | 「相談したい」ロールで新規登録 | プロフィール作成 → トップにリダイレクト |
| AUTH-002 | 「回答したい」ロールで新規登録 | role=advisor でプロフィール作成 |
| AUTH-003 | 「両方」ロールで新規登録 | role=both でプロフィール作成 |
| AUTH-004 | ニックネーム未入力で登録 | バリデーションエラー表示、送信されない |
| AUTH-005 | ニックネーム1文字で登録 | 「2〜20文字」エラー表示 |
| AUTH-006 | ニックネーム21文字で登録 | 「2〜20文字」エラー表示 |
| AUTH-007 | パスワード7文字で登録 | 「8文字以上」エラー表示 |
| AUTH-008 | 既存メールで再登録 | 適切なエラーメッセージ（メール情報を漏らさない） |
| AUTH-009 | 正常ログイン | トップにリダイレクト、ヘッダーにニックネーム表示 |
| AUTH-010 | 間違ったパスワードでログイン | エラー表示、入力値はクリアされない |
| AUTH-011 | ログアウト | トップにリダイレクト、セッション Cookie 削除 |
| AUTH-012 | パスワードリセットフロー | メール送信成功メッセージ、メール内リンクで再設定 |
| AUTH-013 | 利用規約チェック無しで登録ボタン押下 | ボタンが disabled のまま or バリデーションエラー |
| AUTH-014 | セッション期限切れ後の操作 | 自動的にログインページにリダイレクト |
| AUTH-015 | 登録直後にページリロード | セッションが維持されている |

### 2-4. 相談投稿フロー（🔴 Critical）

```
Cursorへの指示:

以下のテストを Playwright で実装してください。
テストファイル: tests/e2e/consultation-create.spec.ts
前提: 相談者ロール（role=consulter）でログイン済み。
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| POST-001 | フェーズ「資金繰り」選択 → 困りごとプルダウン表示 | 資金繰りに対応する困りごと一覧が表示される |
| POST-002 | フェーズ切替「資金繰り」→「税金」 | 困りごとプルダウンが税金用にリセットされる |
| POST-003 | 困りごと選択 → タイトル入力 → 本文入力 → 投稿 | 相談が作成され、詳細ページにリダイレクト |
| POST-004 | タイトル未入力で投稿 | バリデーションエラー |
| POST-005 | 本文未入力で投稿 | バリデーションエラー |
| POST-006 | 本文 5000文字超で投稿 | 文字数オーバーエラーまたは入力制限 |
| POST-007 | 回答者ロール（role=advisor）で投稿ページにアクセス | アクセス拒否 or リダイレクト |
| POST-008 | 「メンタル・孤独」フェーズの危機フラグ付き困りごとを選択 | 支援機関リンクが自動表示される |
| POST-009 | 投稿中にネットワークエラー | エラーメッセージ表示、入力内容が消えない |
| POST-010 | 送信ボタン連打（ダブルサブミット防止） | 1件だけ作成される |
| POST-011 | XSS攻撃文字列を含むタイトル/本文で投稿 | サニタイズされて保存、スクリプト実行されない |
| POST-012 | 全8フェーズそれぞれの困りごとプルダウンが正しく表示される | seed データと一致する選択肢が出る |

### 2-5. スレッド表示・返信（🔴 Critical）

```
Cursorへの指示:

以下のテストを Playwright で実装してください。
テストファイル: tests/e2e/thread.spec.ts
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| THR-001 | 相談詳細ページを表示 | タイトル、本文、フェーズ、困りごと、閲覧数が表示 |
| THR-002 | 回答者が depth=1 の返信を投稿 | 返信が相談の下にインデント付きで表示 |
| THR-003 | depth=1 の返信に対して depth=2 の返信を投稿 | さらにインデントされて表示 |
| THR-004 | depth=2 の返信に「返信」ボタンが無い | 3層制限が守られている |
| THR-005 | 相談者が自分の相談に返信 | 投稿者バッジ付きで表示 |
| THR-006 | 空の返信を送信 | バリデーションエラー |
| THR-007 | 返信が10件以上ある場合 | ページネーションまたは「もっと見る」が機能 |
| THR-008 | 閲覧数カウント（同一IP） | 同一IPからの複数アクセスで閲覧数は1のまま |
| THR-009 | 閲覧数カウント（異なるIP） | 異なるIPからのアクセスで閲覧数が増加 |
| THR-010 | 未認証ユーザーの閲覧 | 相談・返信は読める、返信ボタンは非表示/ログイン誘導 |
| THR-011 | 共感ボタン押下 | カウント+1、再押下でカウント−1（トグル） |
| THR-012 | 通報ボタン押下 | 通報理由選択モーダル表示、送信成功メッセージ |

### 2-6. モーダル/ポップアップ制御（🟡 High）

```
Cursorへの指示:

shadcn/ui の Dialog / AlertDialog / Popover / DropdownMenu を使っている箇所すべてに対し、
以下のテストを Playwright で実装してください。
テストファイル: tests/e2e/modal-control.spec.ts
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| MOD-001 | モーダルを開く → ESC キー | モーダルが閉じる |
| MOD-002 | モーダルを開く → 背景（オーバーレイ）クリック | モーダルが閉じる |
| MOD-003 | モーダルを開く → ✕ ボタンクリック | モーダルが閉じる |
| MOD-004 | モーダル内でフォーカスが閉じ込められる | Tab キーでモーダル外に出ない |
| MOD-005 | モーダルが開いている間、背景がスクロールしない | body に overflow:hidden が付与される |
| MOD-006 | モーダルを開く → 閉じる → 再度開く | 正常に開閉を繰り返せる |
| MOD-007 | 確認ダイアログ（投稿削除等）で「キャンセル」押下 | 何も起きずダイアログが閉じる |
| MOD-008 | 確認ダイアログで「実行」押下 | アクション実行後にダイアログが閉じる |
| MOD-009 | ドロップダウンメニュー開 → 外側クリック | メニューが閉じる |
| MOD-010 | ドロップダウンメニュー開 → スクロール | メニューが要素に追従するか正しく閉じる |
| MOD-011 | 2つのポップアップが同時に開かない | 一方を開くと他方が閉じる |
| MOD-012 | モーダル内のフォーム送信 → 成功 | モーダルが自動で閉じ、成功トースト表示 |

### 2-7. レスポンシブ UI（🟡 High）

```
Cursorへの指示:

以下の 3 ビューポートでテストしてください。
テストファイル: tests/e2e/responsive.spec.ts

const viewports = [
  { name: 'mobile', width: 375, height: 812 },   // iPhone SE
  { name: 'tablet', width: 768, height: 1024 },   // iPad
  { name: 'desktop', width: 1440, height: 900 },  // ラップトップ
]
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| RES-001 | モバイルでヘッダーのナビ表示 | ハンバーガーメニュー or ボトムナビが機能 |
| RES-002 | モバイルでフェーズタブが横スクロール可能 | タブが隠れずスクロールで到達可能 |
| RES-003 | モバイルで相談投稿フォーム完走 | フェーズ選択 → プルダウン → テキスト → 送信が問題なく完了 |
| RES-004 | タブレットでスレッド表示 | インデントが崩れない |
| RES-005 | デスクトップで支援リンク一覧 | カード表示が正しくグリッド配置 |
| RES-006 | テキストの切り詰めが正しい | 長いタイトル/本文が `...` で省略、ホバーで全文表示 |

### 2-8. フォームバリデーション（🟡 High）

```
Cursorへの指示:

全フォーム（登録・ログイン・投稿・返信・通報・プロフィール編集）に対し共通パターンをテスト。
テストファイル: tests/e2e/form-validation.spec.ts
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| FORM-001 | 必須フィールドを空で送信 | フィールドごとにエラー表示、送信されない |
| FORM-002 | 不正な形式のメールアドレス | リアルタイムバリデーション or 送信時エラー |
| FORM-003 | 文字数制限超過 | 入力制限 or 明確なエラーメッセージ |
| FORM-004 | 送信中のローディング状態 | ボタンが disabled + スピナー表示 |
| FORM-005 | 送信成功後のフォームリセット | フィールドがクリアされるか、遷移する |
| FORM-006 | サーバーエラー（500）時のフォーム | エラーメッセージ表示、入力値は保持 |
| FORM-007 | 日本語入力（IME確定前のEnter） | IME確定中のEnterでフォーム送信されない |

### 2-9. 通知・メール（🟡 High）

```
Cursorへの指示:

メール送信は Resend の Test Mode または Mock で検証してください。
テストファイル: tests/e2e/notifications.spec.ts（E2E はモック使用）
テストファイル: tests/integration/email.test.ts（統合テスト）
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| NOTIF-001 | 相談に返信 → 相談者にメール通知 | 1時間以内にダイジェストメール送信 |
| NOTIF-002 | 返信に返信 → 元の返信者にメール通知 | 通知メールに返信リンク含む |
| NOTIF-003 | 通知設定 OFF のユーザーへの返信 | メール送信されない |
| NOTIF-004 | 自分自身への返信 | 自己通知は送信されない |
| NOTIF-005 | メールのリンクをクリック | 該当の相談詳細ページに遷移 |

### 2-10. アクセス制御（🔴 Critical）

```
Cursorへの指示:

RLS ポリシーの動作確認と、フロントエンド側のガード両方をテスト。
テストファイル: tests/e2e/access-control.spec.ts
テストファイル: tests/integration/rls-policies.test.ts
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| ACL-001 | 未認証ユーザー → 相談一覧閲覧 | 閲覧可能 |
| ACL-002 | 未認証ユーザー → 相談投稿 | ログインページにリダイレクト |
| ACL-003 | 相談者ロール → 相談投稿 | 投稿可能 |
| ACL-004 | 回答者ロール → 相談投稿 | 拒否（フロント + RLS） |
| ACL-005 | 回答者ロール → 返信投稿 | 投稿可能 |
| ACL-006 | 相談者ロール → 他人の相談を編集/削除 | 拒否 |
| ACL-007 | 他ユーザーのプロフィール API を直接叩いて更新 | RLS で拒否 |
| ACL-008 | 管理者ロール → 投稿の非表示/削除 | 実行可能 |
| ACL-009 | 一般ユーザー → 管理画面 URL 直接アクセス | リダイレクトまたは 403 |
| ACL-010 | 停止(suspended)ユーザーでログイン後の操作 | 投稿・返信不可、閲覧のみ |

### 2-11. エッジケース・異常系（🟠 Medium）

```
Cursorへの指示:

テストファイル: tests/e2e/edge-cases.spec.ts
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| EDGE-001 | 相談が 0 件の一覧ページ | 空状態メッセージ表示（現在は実装済みを確認） |
| EDGE-002 | 返信が 0 件の相談詳細 | 「まだ返信がありません」表示 |
| EDGE-003 | 100件以上の相談がある一覧 | ページネーションが正しく機能 |
| EDGE-004 | 同時に2つのタブで同じ相談を開いて返信 | 両方正しく保存される |
| EDGE-005 | 長文（3000文字）のタイトルを API 直接送信 | サーバー側バリデーションで拒否 |
| EDGE-006 | SQL インジェクション文字列をフォームに入力 | サニタイズされる（Supabase parameterized query） |
| EDGE-007 | レート制限超過（連続 POST） | 429 エラー、適切なメッセージ表示 |
| EDGE-008 | 削除済みの相談 URL に直接アクセス | 404 or 「この相談は削除されました」表示 |
| EDGE-009 | 非表示(hidden)の相談 URL に直接アクセス | 一般ユーザーには見えない、管理者には見える |

### 2-12. パフォーマンス（🟠 Medium）

```
Cursorへの指示:

Lighthouse CI と Playwright のパフォーマンス計測を組み合わせてください。
テストファイル: tests/performance/lighthouse.spec.ts
```

| ID | テストケース | 閾値 |
|----|------------|------|
| PERF-001 | トップページ LCP | < 2.5s |
| PERF-002 | トップページ FID/INP | < 200ms |
| PERF-003 | トップページ CLS | < 0.1 |
| PERF-004 | 相談一覧ページ TTFB | < 800ms（CF Workers cold start 込み） |
| PERF-005 | 相談詳細ページ（返信20件） | ページロード < 3s |
| PERF-006 | バンドルサイズ | メインチャンク < 200KB gzip |
| PERF-007 | 画像最適化 | next/image 使用、WebP 配信 |

### 2-13. アクセシビリティ（🟠 Medium）

```
Cursorへの指示:

axe-core を Playwright と統合してテスト。
テストファイル: tests/a11y/accessibility.spec.ts

pnpm add -D @axe-core/playwright
```

| ID | テストケース | 期待結果 |
|----|------------|---------|
| A11Y-001 | 全ページで axe-core の violations が 0 | Critical / Serious の violation なし |
| A11Y-002 | Tab キーでフォーム操作が完結 | マウス無しで登録 → ログイン → 投稿 → 返信 |
| A11Y-003 | スクリーンリーダーで相談一覧を読み上げ | フェーズ・タイトル・閲覧数が正しく読み上げ |
| A11Y-004 | 色コントラスト比 | WCAG AA 基準（4.5:1）をクリア |
| A11Y-005 | フォーカスインジケーター | 全インタラクティブ要素にフォーカスリングが表示 |

---

## 3. テスト環境セットアップ

```
Cursorへの指示:

以下のコマンドでテスト環境を構築してください。
```

### 3-1. パッケージインストール

```bash
pnpm add -D playwright @playwright/test @axe-core/playwright
npx playwright install chromium
```

### 3-2. Playwright 設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results.json' }]],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
```

### 3-3. テストユーティリティ

```typescript
// tests/helpers/auth.ts
import { Page } from '@playwright/test'

export async function loginAs(page: Page, role: 'consulter' | 'advisor' | 'both' | 'admin') {
  const credentials = {
    consulter: { email: process.env.TEST_CONSULTER_EMAIL!, password: process.env.TEST_CONSULTER_PASSWORD! },
    advisor: { email: process.env.TEST_ADVISOR_EMAIL!, password: process.env.TEST_ADVISOR_PASSWORD! },
    both: { email: process.env.TEST_BOTH_EMAIL!, password: process.env.TEST_BOTH_PASSWORD! },
    admin: { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! },
  }
  const { email, password } = credentials[role]

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await page.waitForURL('/')
}

export async function createTestConsultation(page: Page, options?: {
  phase?: string
  title?: string
  body?: string
}) {
  await page.goto('/consultations/new')

  // フェーズ選択
  const phase = options?.phase || '資金繰り'
  await page.getByRole('tab', { name: phase }).click()

  // 困りごと選択（最初の項目）
  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()

  // タイトル・本文
  await page.getByLabel('タイトル').fill(options?.title || 'テスト相談タイトル')
  await page.getByLabel('本文').fill(options?.body || 'テスト相談の本文です。資金繰りについて悩んでいます。')

  // 送信
  await page.getByRole('button', { name: '投稿する' }).click()
  await page.waitForURL(/\/consultations\/[a-z0-9-]+/)
}
```

### 3-4. 環境変数テンプレート

```bash
# .env.test
BASE_URL=http://localhost:3000
TEST_CONSULTER_EMAIL=test-consulter@morimichi.cc
TEST_CONSULTER_PASSWORD=TestPassword123!
TEST_ADVISOR_EMAIL=test-advisor@morimichi.cc
TEST_ADVISOR_PASSWORD=TestPassword123!
TEST_BOTH_EMAIL=test-both@morimichi.cc
TEST_BOTH_PASSWORD=TestPassword123!
TEST_ADMIN_EMAIL=test-admin@morimichi.cc
TEST_ADMIN_PASSWORD=TestPassword123!
```

---

## 4. CI/CD 統合（Cloudflare Workers）

```
Cursorへの指示:

GitHub Actions で PR ごとにテストを自動実行する設定を作成してください。
```

```yaml
# .github/workflows/qa.yml
name: QA Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium

      # Unit + Integration tests
      - name: Run unit tests
        run: pnpm test

      # E2E tests
      - name: Run E2E tests
        run: pnpm exec playwright test
        env:
          BASE_URL: http://localhost:3000
          TEST_CONSULTER_EMAIL: ${{ secrets.TEST_CONSULTER_EMAIL }}
          TEST_CONSULTER_PASSWORD: ${{ secrets.TEST_CONSULTER_PASSWORD }}
          TEST_ADVISOR_EMAIL: ${{ secrets.TEST_ADVISOR_EMAIL }}
          TEST_ADVISOR_PASSWORD: ${{ secrets.TEST_ADVISOR_PASSWORD }}
          TEST_BOTH_EMAIL: ${{ secrets.TEST_BOTH_EMAIL }}
          TEST_BOTH_PASSWORD: ${{ secrets.TEST_BOTH_PASSWORD }}
          TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}

      # Upload results
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      # Deploy preview (PR only)
      - name: Deploy preview
        if: github.event_name == 'pull_request'
        run: wrangler deploy --env preview
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## 5. 実行優先順とCursorプロンプト

### Phase 1（即日修正 — 本番で再現された問題）

```
Cursorプロンプト:

globals.css を開いて、* や html にかかっている transition: all を探して削除してください。
transition は以下の要素にだけ個別に付けてください:
- ボタン: transition-colors duration-150
- リンク: transition-colors duration-150
- モーダルオーバーレイ: transition-opacity duration-200
- ドロップダウン: transition-all duration-150
- カード hover: transition-shadow duration-200

修正後、全ページで DevTools の Computed タブを開き、
<html> 要素に transition が無いことを確認してください。
```

### Phase 2（1〜2日 — ローディング・遷移体験）

```
Cursorプロンプト:

1. 以下の全ルートに loading.tsx を作成:
   app/(public)/loading.tsx, app/(public)/consultations/loading.tsx,
   app/(public)/consultations/[id]/loading.tsx, app/(public)/support/loading.tsx,
   app/(auth)/login/loading.tsx, app/(auth)/register/loading.tsx

2. 相談一覧と相談詳細にはスケルトンUIを実装。
   animate-pulse クラスを使った灰色のプレースホルダーブロック。

3. Next.js Link コンポーネントの prefetch 設定を見直し:
   - 公開ページ（相談一覧、支援リンク）: prefetch={true}
   - 認証ページ: prefetch={false}
```

### Phase 3（3〜5日 — テスト基盤構築）

```
Cursorプロンプト:

Playwright テスト環境を構築してください。

1. pnpm add -D playwright @playwright/test @axe-core/playwright
2. npx playwright install chromium
3. このQAガイドの Section 3 の playwright.config.ts とヘルパーをそのまま作成
4. tests/e2e/ に以下の順でテストファイルを作成:
   - auth.spec.ts（AUTH-001〜015）
   - consultation-create.spec.ts（POST-001〜012）
   - thread.spec.ts（THR-001〜012）
   - modal-control.spec.ts（MOD-001〜012）
   - navigation.spec.ts（NAV-001〜007）
5. 各テストはこのガイドのテストケース表に従って実装
```

### Phase 4（1週間〜 — 継続的QA）

```
Cursorプロンプト:

1. .github/workflows/qa.yml を作成（このガイドの Section 4 参照）
2. PRごとにPlaywrightテストを自動実行する設定
3. テスト結果レポートをArtifactとして保存
4. Lighthouse CI を追加してパフォーマンス閾値チェック:
   - LCP < 2.5s, CLS < 0.1, INP < 200ms
```

---

## 6. Supabase RLS 統合テスト

```
Cursorへの指示:

Supabase のサービスロールキーを使って、RLS ポリシーを直接テストしてください。
テストファイル: tests/integration/rls-policies.test.ts
```

```typescript
// テストパターン（概要）
// 各テストで Supabase client を異なるユーザートークンで生成し、
// 実際にクエリを発行して RLS の許可/拒否を検証する

describe('RLS Policies', () => {
  describe('consultations', () => {
    test('未認証ユーザーは published の相談を閲覧可能', async () => {
      const { data, error } = await anonClient
        .from('consultations')
        .select('*')
        .eq('status', 'published')
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    test('相談者ロールは相談を作成可能', async () => {
      const { error } = await consulterClient
        .from('consultations')
        .insert({ phase_id: testPhaseId, title: 'テスト', body: 'テスト本文' })
      expect(error).toBeNull()
    })

    test('回答者ロールは相談を作成不可', async () => {
      const { error } = await advisorClient
        .from('consultations')
        .insert({ phase_id: testPhaseId, title: 'テスト', body: 'テスト本文' })
      expect(error).not.toBeNull()
    })

    test('他ユーザーの相談を更新不可', async () => {
      const { error } = await consulterClient
        .from('consultations')
        .update({ title: '改変' })
        .eq('id', otherUserConsultationId)
      expect(error).not.toBeNull()
    })
  })
})
```

---

## 7. チェックリスト（リリース前ゲート）

### 🔴 ブロッカー（これが通らないとデプロイしない）

- [ ] `transition: all` グローバル汚染が解消されている
- [ ] 全ページに loading.tsx が存在する
- [ ] AUTH-001〜015 が全パス
- [ ] POST-001〜012 が全パス
- [ ] THR-001〜012 が全パス
- [ ] ACL-001〜010 が全パス
- [ ] MOD-001〜012 が全パス（モーダルが閉じられなくならない）
- [ ] FORM-007 パス（IME確定前のEnterで送信されない）
- [ ] POST-010 パス（ダブルサブミット防止）

### 🟡 推奨（β運用開始前に対処）

- [ ] NAV-001〜007 が全パス
- [ ] RES-001〜006 が全パス
- [ ] PERF-001〜004 が閾値内
- [ ] A11Y-001 で Critical violation が 0
- [ ] CI/CD パイプラインが稼働

### 🟢 理想（運用しながら改善）

- [ ] PERF-005〜007 最適化
- [ ] A11Y-002〜005 完全対応
- [ ] EDGE-001〜009 が全パス
- [ ] ビジュアルリグレッションテスト導入（Chromatic 等）
