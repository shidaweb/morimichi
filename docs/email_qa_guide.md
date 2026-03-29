# メール送信 品質管理ガイド — Cursor 実行用

> **この文書の使い方**: メール送信が仕様通りに動作しているかを網羅的にチェックし、
> 未実装・不具合を修正するための Cursor 向け QA 指示書です。
> **最優先で対応してください。** メールが届かない = ユーザーが反応を見逃す = サービスが機能しない。

---

## 0. 前提: メール送信基盤の確認

```
Cursorプロンプト（最初に必ず実行）:

以下の3点をまず確認し、結果を報告してください。
問題があればこの時点で修正してください。

1. Resend SDK がインストールされているか:
   - package.json に "resend" が含まれているか確認
   - 無ければ: pnpm add resend

2. Resend クライアントが正しく初期化されているか:
   - src/lib/email/resend.ts（または同等のファイル）が存在するか
   - 無ければ以下を作成:

   // src/lib/email/resend.ts
   import { Resend } from 'resend'

   let resendClient: Resend | null = null

   export function getResend(): Resend {
     if (!resendClient) {
       const apiKey = process.env.RESEND_API_KEY
       if (!apiKey) {
         throw new Error('RESEND_API_KEY is not set')
       }
       resendClient = new Resend(apiKey)
     }
     return resendClient
   }

3. 環境変数が設定されているか:
   - wrangler.toml の [vars] または wrangler secret に RESEND_API_KEY が存在するか
   - .env.local に RESEND_API_KEY が存在するか
   - Resend ダッシュボードで morimichi.cc ドメインが検証済みか確認
   - 送信元アドレス（例: noreply@morimichi.cc）がドメインに紐づいているか

上記3点すべてOKになってから次へ進んでください。
```

---

## 1. メール送信ポイント完全一覧

以下が morimichi.cc で送信されるべき全メールです。**すべてのポイントで Resend 経由の送信コードが実装されていることを確認してください。**

### カテゴリA: 認証系メール（Supabase Auth 管理）

| ID | トリガー | 宛先 | 件名 | 管理主体 |
|----|---------|------|------|---------|
| A-1 | 新規会員登録 | 登録者 | メールアドレスを確認してください | Supabase Auth |
| A-2 | 認証メール再送 | 登録者 | メールアドレスを確認してください | Supabase Auth |
| A-3 | パスワードリセット要求 | 登録者 | パスワードをリセットしてください | Supabase Auth |

### カテゴリB: 双方向通知メール（Resend 送信）

| ID | トリガー | 宛先 | 件名 | 送信タイミング |
|----|---------|------|------|-------------|
| B-1 | 相談に回答がついた | 相談者 | 【もりみち】あなたの相談に回答がありました | ダイジェスト（1時間） |
| B-2 | 回答に返信がついた | 元の回答者 | 【もりみち】あなたの回答に返信がありました | ダイジェスト（1時間） |
| B-3 | 返信に返信がついた | 元の返信者 | 【もりみち】あなたの返信に回答がありました | ダイジェスト（1時間） |
| B-4 | 投稿に共感がついた | 投稿者 | 【もりみち】あなたの投稿に共感がありました | ダイジェスト（設定ON時のみ） |

### カテゴリC: 運営通知メール（Resend 送信 → master@jugyoin.jp）

| ID | トリガー | 宛先 | 件名 |
|----|---------|------|------|
| C-1 | 通報が送信された | master@jugyoin.jp | 【もりみち】通報 — {target_type}: {target_title} |
| C-2 | 公認再生プロ申請 | master@jugyoin.jp | 【もりみち】公認再生プロ申請 — {nickname}（{specialty}） |
| C-3 | 相談リクエスト受信 | master@jugyoin.jp | 【もりみち】相談リクエスト — {from} → {to} |

### カテゴリD: 管理アクション通知メール（Resend 送信 → ユーザー）

| ID | トリガー | 宛先 | 件名 |
|----|---------|------|------|
| D-1 | 通報対応が完了 | 通報者 | 【もりみち】通報の対応が完了しました |
| D-2 | アカウント警告 | 対象ユーザー | 【もりみち】アカウントに関するお知らせ |
| D-3 | 公認再生プロ申請承認 | 申請者 | 【もりみち】公認再生プロに認定されました |
| D-4 | 公認再生プロ申請却下 | 申請者 | 【もりみち】公認再生プロ申請について |
| D-5 | 相談リクエスト転送 | 対象のプロ | 【もりみち】相談リクエストが届いています |
| D-6 | プロが相談リクエストに回答 | リクエスト送信者 | 【もりみち】相談リクエストへの回答が届きました |

### カテゴリE: システム通知メール（Resend 送信 → ユーザー）

| ID | トリガー | 宛先 | 件名 |
|----|---------|------|------|
| E-1 | ウェルカムメール（メール認証完了後） | 新規ユーザー | 【もりみち】ご登録ありがとうございます |
| E-2 | 退会完了 | 退会者 | 【もりみち】退会が完了しました |

---

## 2. 各メールの実装チェック手順

```
Cursorプロンプト:

以下の手順で、Section 1 の全メール（A-1〜E-2）について
1つずつ実装状況を確認してください。

各メールIDについて:
1. 該当するAPIルートファイル（route.ts）を開く
2. メール送信のコード（Resend.emails.send() または supabase.auth 呼び出し）が存在するか確認
3. 存在しない場合は「❌ 未実装」、存在する場合は「✅ 実装済み」と報告
4. 実装済みの場合も、送信先・件名・本文が仕様と一致しているか確認

結果を以下の形式で報告してください:

| ID | ステータス | ファイルパス | 問題点 |
|----|----------|------------|--------|
| A-1 | ✅ | (Supabase Auth) | なし |
| B-1 | ❌ | src/app/api/replies/route.ts | Resend送信コードなし |
| C-2 | ❌ | src/app/api/pro/apply/route.ts | ファイル自体が未作成 |
...

報告後、❌のものすべてを修正してください。
```

---

## 3. メールテンプレート一式

以下のテンプレートファイルがすべて存在し、正しい内容であることを確認してください。

```
Cursorプロンプト:

src/lib/email/templates/ ディレクトリに以下のファイルがすべて存在するか確認し、
無いものは作成してください。
```

### 3-1. ディレクトリ構成

```
src/lib/email/
├── resend.ts                    # Resend クライアント初期化
├── send.ts                      # 共通送信関数（エラーハンドリング付き）
└── templates/
    ├── reply-notification.ts    # B-1, B-2, B-3: 返信通知
    ├── reaction-notification.ts # B-4: 共感通知
    ├── report-submitted.ts      # C-1: 通報（→運営）
    ├── pro-application.ts       # C-2: プロ申請（→運営）
    ├── contact-request.ts       # C-3: 相談リクエスト（→運営）
    ├── report-resolved.ts       # D-1: 通報対応完了
    ├── account-warning.ts       # D-2: アカウント警告
    ├── pro-approved.ts          # D-3: プロ申請承認
    ├── pro-rejected.ts          # D-4: プロ申請却下
    ├── contact-forwarded.ts     # D-5: リクエスト転送（→プロ）
    ├── contact-responded.ts     # D-6: リクエスト回答（→依頼者）
    ├── welcome.ts               # E-1: ウェルカム
    └── withdrawal.ts            # E-2: 退会完了
```

### 3-2. 共通送信関数

```typescript
// src/lib/email/send.ts

import { getResend } from './resend'

const FROM_ADDRESS = 'もりみち <noreply@morimichi.cc>'
const ADMIN_ADDRESS = 'master@jugyoin.jp'

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{
  success: boolean
  error?: string
}> {
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

export async function sendAdminEmail({ subject, html }: Omit<SendEmailParams, 'to'>): Promise<{
  success: boolean
  error?: string
}> {
  return sendEmail({ to: ADMIN_ADDRESS, subject, html })
}
```

### 3-3. テンプレート実装例

```typescript
// ======================================================
// src/lib/email/templates/pro-application.ts
// C-2: 公認再生プロ申請 → master@jugyoin.jp
// ======================================================

export function proApplicationEmail(data: {
  nickname: string
  email: string
  specialtyName: string
  applicationText: string
  applicationId: string
  appliedAt: string
}) {
  return {
    subject: `【もりみち】公認再生プロ申請 — ${data.nickname}（${data.specialtyName}）`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">公認再生プロ申請</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; width: 140px; font-weight: bold;">ニックネーム</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.nickname)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">メールアドレス</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.email)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">専門分野</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.specialtyName)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">申請日時</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.appliedAt}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">申請内容</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(data.applicationText)}</td>
          </tr>
        </table>
        <a href="https://morimichi.cc/admin/pro/applications/${data.applicationId}"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          管理画面で確認する
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/contact-request.ts
// C-3: 相談リクエスト → master@jugyoin.jp
// ======================================================

export function contactRequestEmail(data: {
  requesterNickname: string
  requesterEmail: string
  targetNickname: string
  targetSpecialtyName: string
  subject: string
  message: string
  requestId: string
}) {
  return {
    subject: `【もりみち】相談リクエスト — ${data.requesterNickname} → ${data.targetNickname}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">相談リクエスト</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; width: 140px; font-weight: bold;">依頼者</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.requesterNickname)}（${escapeHtml(data.requesterEmail)}）</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">宛先プロ</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.targetNickname)}（${escapeHtml(data.targetSpecialtyName)}）</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">件名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.subject)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">内容</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
          </tr>
        </table>
        <a href="https://morimichi.cc/admin/contact-requests/${data.requestId}"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          管理画面で確認する
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/reply-notification.ts
// B-1, B-2, B-3: 返信通知
// ======================================================

export function replyNotificationEmail(data: {
  recipientNickname: string
  notificationType: 'reply_to_consultation' | 'reply_to_reply'
  consultationTitle: string
  consultationId: string
  replyCount: number
}) {
  const typeText = data.notificationType === 'reply_to_consultation'
    ? 'あなたの相談に回答がありました'
    : 'あなたの回答に返信がありました'

  return {
    subject: `【もりみち】${typeText}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">${typeText}</h2>
        <p>${escapeHtml(data.recipientNickname)}さん、</p>
        <p>
          「${escapeHtml(data.consultationTitle)}」に
          ${data.replyCount > 1 ? `${data.replyCount}件の` : ''}新しい回答があります。
        </p>
        <p>
          ※ 匿名性保護のため、回答の内容はメールに含めていません。<br>
          サイトでご確認ください。
        </p>
        <a href="https://morimichi.cc/consultations/${data.consultationId}"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          回答を確認する
        </a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          この通知が不要な場合は
          <a href="https://morimichi.cc/mypage" style="color: #6b7280;">マイページの通知設定</a>
          から変更できます。
        </p>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/report-submitted.ts
// C-1: 通報 → master@jugyoin.jp
// ======================================================

export function reportSubmittedEmail(data: {
  reporterNickname: string
  targetType: 'consultation' | 'reply'
  targetTitle: string
  reason: string
  detail: string | null
  reportId: string
}) {
  return {
    subject: `【もりみち】通報 — ${data.targetType === 'consultation' ? '相談' : '返信'}: ${data.targetTitle.slice(0, 30)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">通報を受信しました</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; width: 120px; font-weight: bold;">通報者</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.reporterNickname)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">対象</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.targetType === 'consultation' ? '相談' : '返信'}: ${escapeHtml(data.targetTitle)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">通報理由</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.reason)}</td>
          </tr>
          ${data.detail ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">詳細</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(data.detail)}</td>
          </tr>` : ''}
        </table>
        <a href="https://morimichi.cc/admin/reports/${data.reportId}"
           style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          管理画面で確認する
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/pro-approved.ts
// D-3: 公認再生プロ承認 → 申請者
// ======================================================

export function proApprovedEmail(data: {
  nickname: string
  specialtyName: string
}) {
  return {
    subject: '【もりみち】公認再生プロに認定されました',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">🏆 公認再生プロに認定されました</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          おめでとうございます。<br>
          <strong>${escapeHtml(data.specialtyName)}</strong>の公認再生プロとして認定されました。
        </p>
        <p>これから以下のことが可能になります:</p>
        <ul>
          <li>プロフィールに黄金バッジが表示されます</li>
          <li>コラム記事を投稿できるようになります</li>
          <li>公認再生プロ一覧に掲載されます</li>
          <li>相談者から運営経由の相談リクエストを受け取れます</li>
        </ul>
        <a href="https://morimichi.cc/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          マイページを確認する
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/pro-rejected.ts
// D-4: 公認再生プロ却下 → 申請者
// ======================================================

export function proRejectedEmail(data: {
  nickname: string
}) {
  return {
    subject: '【もりみち】公認再生プロ申請について',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">公認再生プロ申請について</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          公認再生プロの申請内容を確認いたしましたが、<br>
          現時点ではお見送りとさせていただきました。
        </p>
        <p>
          より詳しい経験や専門性を記載いただくことで、<br>
          再度申請いただくことも可能です。
        </p>
        <a href="https://morimichi.cc/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          マイページへ
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/contact-forwarded.ts
// D-5: 相談リクエスト転送 → プロ
// ======================================================

export function contactForwardedEmail(data: {
  proNickname: string
  requesterNickname: string
  subject: string
  message: string
  requestId: string
}) {
  return {
    subject: '【もりみち】相談リクエストが届いています',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">相談リクエストが届いています</h2>
        <p>${escapeHtml(data.proNickname)}さん、</p>
        <p>${escapeHtml(data.requesterNickname)}さんから運営経由で相談リクエストが届いています。</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; width: 80px; font-weight: bold;">件名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.subject)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">内容</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
          </tr>
        </table>
        <a href="https://morimichi.cc/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          マイページで確認する
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/contact-responded.ts
// D-6: プロが回答 → リクエスト送信者
// ======================================================

export function contactRespondedEmail(data: {
  requesterNickname: string
  proNickname: string
}) {
  return {
    subject: '【もりみち】相談リクエストへの回答が届きました',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">相談リクエストへの回答が届きました</h2>
        <p>${escapeHtml(data.requesterNickname)}さん、</p>
        <p>
          ${escapeHtml(data.proNickname)}さんからの回答が届いています。<br>
          マイページからご確認ください。
        </p>
        <a href="https://morimichi.cc/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          回答を確認する
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/report-resolved.ts
// D-1: 通報対応完了 → 通報者
// ======================================================

export function reportResolvedEmail(data: {
  nickname: string
}) {
  return {
    subject: '【もりみち】通報の対応が完了しました',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">通報の対応が完了しました</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          ご報告いただいた内容について対応が完了しました。<br>
          ご協力ありがとうございました。
        </p>
        <p style="font-size: 14px; color: #6b7280;">
          ※ 対応内容の詳細はプライバシー保護のためお伝えしておりません。
        </p>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/account-warning.ts
// D-2: アカウント警告 → 対象ユーザー
// ======================================================

export function accountWarningEmail(data: {
  nickname: string
  reason: string
}) {
  return {
    subject: '【もりみち】アカウントに関するお知らせ',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">アカウントに関するお知らせ</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          あなたのアカウントに関して、以下のお知らせがあります。
        </p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(data.reason)}</p>
        </div>
        <p>
          利用規約に沿ったご利用をお願いいたします。<br>
          ご不明点があればお問い合わせください。
        </p>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/welcome.ts
// E-1: ウェルカムメール
// ======================================================

export function welcomeEmail(data: {
  nickname: string
  role: string
}) {
  const roleText = data.role === 'consulter' ? '相談者'
    : data.role === 'advisor' ? '回答者'
    : '相談者・回答者'

  return {
    subject: '【もりみち】ご登録ありがとうございます',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">もりみちへようこそ</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          「${roleText}」としてのご登録ありがとうございます。<br>
          経営のしんどさを、一人で抱え込まなくてよい場所です。
        </p>
        <a href="https://morimichi.cc"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          もりみちを見る
        </a>
      </div>
    `,
  }
}

// ======================================================
// src/lib/email/templates/withdrawal.ts
// E-2: 退会完了メール
// ======================================================

export function withdrawalEmail(data: {
  nickname: string
}) {
  return {
    subject: '【もりみち】退会が完了しました',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">退会が完了しました</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          もりみちをご利用いただきありがとうございました。<br>
          またいつでもお越しください。
        </p>
      </div>
    `,
  }
}

// ======================================================
// 共通ユーティリティ（全テンプレートで使用）
// ======================================================

// src/lib/email/utils.ts
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

---

## 4. API ルート別の送信コード埋め込み確認

```
Cursorプロンプト:

以下の各APIルートファイルを開き、メール送信コードが正しく組み込まれているか確認してください。
無い場合は追加してください。
メール送信は「処理の最後、レスポンス返却の直前」に行い、
メール送信の失敗でAPIレスポンス自体が失敗しないようにしてください（fire-and-forget）。
```

### 4-1. 返信投稿時（B-1, B-2, B-3）

```typescript
// src/app/api/replies/route.ts（または該当ファイル）の POST ハンドラ内

// 返信 INSERT 成功後に追加:
import { sendEmail } from '@/lib/email/send'
import { replyNotificationEmail } from '@/lib/email/templates/reply-notification'

// 通知対象者を特定
// - depth=1（相談への回答）→ 相談者に通知（B-1）
// - depth=2（回答への返信）→ 元の回答者に通知（B-2, B-3）
// - 自分自身への通知は除外
// - notification_on_reply = false のユーザーは除外

// ⚠️ ここが最も抜けやすいポイント。以下の条件を全て確認:
if (targetUser.user_id !== currentUser.id && targetProfile.notification_on_reply) {
  const emailData = replyNotificationEmail({
    recipientNickname: targetProfile.nickname,
    notificationType: reply.depth === 1 ? 'reply_to_consultation' : 'reply_to_reply',
    consultationTitle: consultation.title,
    consultationId: consultation.id,
    replyCount: 1,
  })
  // fire-and-forget（メール失敗でAPIレスポンスは失敗させない）
  sendEmail({ to: targetUser.email, ...emailData }).catch(console.error)
}
```

### 4-2. 通報送信時（C-1）

```typescript
// src/app/api/reports/route.ts の POST ハンドラ内

// 通報 INSERT 成功後に追加:
import { sendAdminEmail } from '@/lib/email/send'
import { reportSubmittedEmail } from '@/lib/email/templates/report-submitted'

const emailData = reportSubmittedEmail({
  reporterNickname: reporterProfile.nickname,
  targetType: body.target_type,
  targetTitle: targetContent.title || targetContent.body?.slice(0, 50) || '(無題)',
  reason: body.reason,
  detail: body.detail || null,
  reportId: newReport.id,
})
sendAdminEmail(emailData).catch(console.error)
```

### 4-3. 公認再生プロ申請時（C-2）

```typescript
// src/app/api/pro/apply/route.ts の POST ハンドラ内

// 申請 INSERT 成功後に追加:
import { sendAdminEmail } from '@/lib/email/send'
import { proApplicationEmail } from '@/lib/email/templates/pro-application'

const emailData = proApplicationEmail({
  nickname: profile.nickname,
  email: user.email!,
  specialtyName: specialty.name,
  applicationText: body.application_text,
  applicationId: newApplication.id,
  appliedAt: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
})
// ⚠️ ここが master@jugyoin.jp に届くかどうかの最重要ポイント
const result = await sendAdminEmail(emailData)
if (!result.success) {
  console.error('CRITICAL: Pro application email failed!', result.error)
  // メール失敗でもAPIレスポンスは成功にする（申請自体はDBに保存済み）
  // ただしログに CRITICAL として記録
}
```

### 4-4. 申請承認/却下時（D-3, D-4）

```typescript
// src/app/api/admin/pro/applications/[id]/route.ts の PATCH ハンドラ内

import { sendEmail } from '@/lib/email/send'
import { proApprovedEmail } from '@/lib/email/templates/pro-approved'
import { proRejectedEmail } from '@/lib/email/templates/pro-rejected'

if (body.action === 'approve') {
  // profiles 更新後:
  const emailData = proApprovedEmail({
    nickname: applicantProfile.nickname,
    specialtyName: specialty.name,
  })
  sendEmail({ to: applicantUser.email!, ...emailData }).catch(console.error)
}

if (body.action === 'reject') {
  const emailData = proRejectedEmail({
    nickname: applicantProfile.nickname,
  })
  sendEmail({ to: applicantUser.email!, ...emailData }).catch(console.error)
}
```

### 4-5. 相談リクエスト送信時（C-3）

```typescript
// src/app/api/contact-requests/route.ts の POST ハンドラ内

import { sendAdminEmail } from '@/lib/email/send'
import { contactRequestEmail } from '@/lib/email/templates/contact-request'

const emailData = contactRequestEmail({
  requesterNickname: requesterProfile.nickname,
  requesterEmail: requesterUser.email!,
  targetNickname: targetProfile.nickname,
  targetSpecialtyName: targetSpecialty.name,
  subject: body.subject,
  message: body.message,
  requestId: newRequest.id,
})
sendAdminEmail(emailData).catch(console.error)
```

### 4-6. リクエスト転送時（D-5）

```typescript
// src/app/api/admin/contact-requests/[id]/route.ts の PATCH (forward) 内

import { sendEmail } from '@/lib/email/send'
import { contactForwardedEmail } from '@/lib/email/templates/contact-forwarded'

const emailData = contactForwardedEmail({
  proNickname: targetProProfile.nickname,
  requesterNickname: requesterProfile.nickname,
  subject: request.subject,
  message: request.message,
  requestId: request.id,
})
sendEmail({ to: targetProUser.email!, ...emailData }).catch(console.error)
```

### 4-7. 通報対応完了時（D-1）、アカウント警告時（D-2）

```typescript
// src/app/api/admin/reports/[id]/route.ts の PATCH 内（resolved時）

import { sendEmail } from '@/lib/email/send'
import { reportResolvedEmail } from '@/lib/email/templates/report-resolved'

sendEmail({
  to: reporterUser.email!,
  ...reportResolvedEmail({ nickname: reporterProfile.nickname }),
}).catch(console.error)

// アカウント警告（warn アクション実行時）
import { accountWarningEmail } from '@/lib/email/templates/account-warning'

sendEmail({
  to: targetUser.email!,
  ...accountWarningEmail({
    nickname: targetProfile.nickname,
    reason: body.note || '利用規約に抵触する投稿がありました。',
  }),
}).catch(console.error)
```

### 4-8. 会員登録完了時（E-1）、退会時（E-2）

```typescript
// E-1: メール認証完了のコールバック内（Supabase の webhook または auth 状態変化時）
// src/app/api/auth/callback/route.ts など

import { sendEmail } from '@/lib/email/send'
import { welcomeEmail } from '@/lib/email/templates/welcome'

// 新規ユーザーの場合のみ（emailVerified が初めて true になった時）
sendEmail({
  to: user.email!,
  ...welcomeEmail({ nickname: profile.nickname, role: profile.role }),
}).catch(console.error)

// E-2: 退会処理内
// src/app/api/users/me/route.ts の DELETE ハンドラ内

import { withdrawalEmail } from '@/lib/email/templates/withdrawal'

// 退会処理の最後（アカウント削除前に送信）
await sendEmail({
  to: user.email!,
  ...withdrawalEmail({ nickname: profile.nickname }),
})
// ※ 退会メールはawaitで待つ（削除後は送れないため）
```

---

## 5. テスト手順

```
Cursorプロンプト:

以下のテストを Playwright + Resend テストモードで実装してください。
テストファイル: tests/e2e/email-delivery.spec.ts
テストファイル: tests/integration/email-templates.test.ts
```

### 5-1. 単体テスト（テンプレート）

```typescript
// tests/integration/email-templates.test.ts

import { proApplicationEmail } from '@/lib/email/templates/pro-application'
import { replyNotificationEmail } from '@/lib/email/templates/reply-notification'
import { contactRequestEmail } from '@/lib/email/templates/contact-request'
// ... 全テンプレートをimport

describe('Email Templates', () => {
  test('全テンプレートが subject と html を返す', () => {
    const templates = [
      proApplicationEmail({ nickname: 'テスト', email: 'test@test.com', specialtyName: '事業再生', applicationText: 'テスト内容', applicationId: 'uuid', appliedAt: '2026-03-29' }),
      replyNotificationEmail({ recipientNickname: 'テスト', notificationType: 'reply_to_consultation', consultationTitle: 'テスト相談', consultationId: 'uuid', replyCount: 1 }),
      contactRequestEmail({ requesterNickname: 'テスト', requesterEmail: 'test@test.com', targetNickname: 'プロ', targetSpecialtyName: '弁護士', subject: '件名', message: '本文', requestId: 'uuid' }),
      // ... 全テンプレート
    ]

    templates.forEach(t => {
      expect(t.subject).toBeTruthy()
      expect(t.subject).toContain('もりみち')
      expect(t.html).toBeTruthy()
      expect(t.html).not.toContain('undefined')
      expect(t.html).not.toContain('null')
    })
  })

  test('XSS文字列がエスケープされる', () => {
    const result = proApplicationEmail({
      nickname: '<script>alert("xss")</script>',
      email: 'test@test.com',
      specialtyName: '事業再生',
      applicationText: '<img onerror="alert(1)" src=x>',
      applicationId: 'uuid',
      appliedAt: '2026-03-29',
    })
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('onerror=')
  })

  test('master@jugyoin.jp 宛メールに管理画面リンクが含まれる', () => {
    const app = proApplicationEmail({ nickname: 'テスト', email: 'test@test.com', specialtyName: '事業再生', applicationText: '内容', applicationId: 'test-id', appliedAt: '2026-03-29' })
    expect(app.html).toContain('https://morimichi.cc/admin/pro/applications/test-id')

    const req = contactRequestEmail({ requesterNickname: 'テスト', requesterEmail: 'test@test.com', targetNickname: 'プロ', targetSpecialtyName: '弁護士', subject: '件名', message: '本文', requestId: 'req-id' })
    expect(req.html).toContain('https://morimichi.cc/admin/contact-requests/req-id')
  })
})
```

### 5-2. E2E テスト（メール送信の発火確認）

```typescript
// tests/e2e/email-delivery.spec.ts

// ⚠️ Resend のテストモードを使用するか、
// sendEmail をモックして「呼ばれたこと」を確認する

import { test, expect } from '@playwright/test'
import { loginAs, createTestConsultation } from '../helpers/auth'

test.describe('メール送信の発火確認', () => {

  test('B-1: 相談に回答 → 相談者に通知メールが発火', async ({ page }) => {
    // 1. 相談者で相談を作成
    await loginAs(page, 'consulter')
    await createTestConsultation(page)
    const consultationUrl = page.url()

    // 2. 回答者でログインし回答
    await loginAs(page, 'advisor')
    await page.goto(consultationUrl)
    await page.getByLabel('回答').fill('テスト回答です')
    await page.getByRole('button', { name: '回答する' }).click()

    // 3. email_notifications テーブルにレコードが作成されたことを確認
    //    （または Resend のログを確認）
  })

  test('C-2: 公認再生プロ申請 → master@jugyoin.jp にメール', async ({ page }) => {
    await loginAs(page, 'advisor')
    await page.goto('/mypage')
    await page.getByRole('button', { name: '公認再生プロ申請をする' }).click()

    // 専門分野選択
    await page.getByLabel('専門分野').selectOption('restructuring')
    // 申請内容入力
    await page.getByLabel('過去の経験').fill('10年間の事業再生コンサルティング経験があります。')
    // 送信
    await page.getByRole('button', { name: '申請を送信する' }).click()

    // 「受け付けました」表示を確認
    await expect(page.getByText('公認再生プロ申請を受け付けました')).toBeVisible()

    // ⚠️ ここでメール送信が発火したことを確認（モックまたはログ検証）
  })

  test('C-3: 相談リクエスト → master@jugyoin.jp にメール', async ({ page }) => {
    await loginAs(page, 'consulter')
    await page.goto('/pro')

    // プロカードの「運営を通じて相談する」ボタン
    await page.getByRole('button', { name: '運営を通じて相談する' }).first().click()

    // フォーム入力
    await page.getByLabel('件名').fill('事業再生について相談したい')
    await page.getByLabel('ご相談内容').fill('テスト相談内容です。')
    await page.getByRole('button', { name: '相談リクエストを送信する' }).click()

    await expect(page.getByText('相談リクエストを送信しました')).toBeVisible()
  })
})
```

---

## 6. デバッグ用: メール送信ログの確認方法

```
Cursorプロンプト:

メール送信の成功/失敗をリアルタイムで確認できるよう、
以下のログ強化を実施してください。
```

```typescript
// src/lib/email/send.ts に以下のログ強化を追加

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const startTime = Date.now()

  try {
    const resend = getResend()

    console.log('[Email Sending]', {
      to,
      subject,
      timestamp: new Date().toISOString(),
    })

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    })

    const duration = Date.now() - startTime

    if (error) {
      console.error('[Email FAILED]', {
        to,
        subject,
        error: error.message,
        duration_ms: duration,
      })
      return { success: false, error: error.message }
    }

    console.log('[Email SUCCESS]', {
      to,
      subject,
      resend_id: data?.id,
      duration_ms: duration,
    })
    return { success: true }

  } catch (err) {
    const duration = Date.now() - startTime
    console.error('[Email EXCEPTION]', {
      to,
      subject,
      error: err instanceof Error ? err.message : 'Unknown',
      stack: err instanceof Error ? err.stack : undefined,
      duration_ms: duration,
    })
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
```

---

## 7. チェックリスト（Cursor が全て完了するまで終わらない）

### 🔴 基盤（これが無いと全メールが送れない）

- [ ] `resend` パッケージがインストールされている
- [ ] `src/lib/email/resend.ts` が存在し、RESEND_API_KEY を参照している
- [ ] `src/lib/email/send.ts` が存在し、sendEmail / sendAdminEmail 関数がある
- [ ] `src/lib/email/utils.ts` の escapeHtml が存在する
- [ ] 環境変数 `RESEND_API_KEY` が .env.local と wrangler secret の両方に設定済み
- [ ] 送信元ドメイン（morimichi.cc）が Resend で検証済み

### 🔴 運営通知（master@jugyoin.jp 宛 — 最優先）

- [ ] C-1: 通報送信時 → master@jugyoin.jp にメール送信コードが存在する
- [ ] C-2: 公認再生プロ申請時 → master@jugyoin.jp にメール送信コードが存在する
- [ ] C-3: 相談リクエスト送信時 → master@jugyoin.jp にメール送信コードが存在する
- [ ] 上記3つすべてに管理画面への直リンクが含まれている

### 🔴 ユーザー通知（MVP必須）

- [ ] B-1: 相談に回答がついた → 相談者にメール
- [ ] B-2: 回答に返信がついた → 回答者にメール
- [ ] B-3: 返信に返信がついた → 元の返信者にメール
- [ ] B-1〜B-3 で自分自身への通知が除外されている
- [ ] B-1〜B-3 で notification_on_reply = false のユーザーが除外されている
- [ ] B-1〜B-3 のメール本文に投稿内容が含まれていない（匿名性保護）
- [ ] B-1〜B-3 のメールに通知解除リンク（マイページへのリンク）が含まれている

### 🟡 管理アクション通知

- [ ] D-1: 通報対応完了 → 通報者にメール
- [ ] D-2: アカウント警告 → 対象ユーザーにメール
- [ ] D-3: 公認再生プロ申請承認 → 申請者にメール
- [ ] D-4: 公認再生プロ申請却下 → 申請者にメール
- [ ] D-5: 相談リクエスト転送 → 対象プロにメール
- [ ] D-6: プロが相談リクエストに回答 → 依頼者にメール

### 🟡 システム通知

- [ ] E-1: メール認証完了 → ウェルカムメール
- [ ] E-2: 退会処理 → 退会完了メール（削除前に送信）

### 🟢 テスト

- [ ] 全テンプレートの単体テストがパス
- [ ] XSSエスケープのテストがパス
- [ ] 管理画面リンクのテストがパス
- [ ] E2E で C-2（プロ申請）の送信が発火することを確認
- [ ] ログ強化が実装され、Sentry/console にメール送信結果が記録される

---

## 8. よくある未実装パターンと修正方法

| 症状 | 原因 | 修正 |
|------|------|------|
| 全メールが届かない | `resend` 未インストール or RESEND_API_KEY 未設定 | Section 0 を最初に実行 |
| master@jugyoin.jp にだけ届かない | sendAdminEmail の宛先が間違っている | `send.ts` の ADMIN_ADDRESS を確認 |
| 申請フォーム送信でメールが飛ばない | API route に sendEmail の呼び出しが無い | Section 4-3 のコードを追加 |
| 返信通知が飛ばない | reply POST の route.ts にメール送信コードが無い | Section 4-1 のコードを追加 |
| メールが飛ぶが HTML が壊れている | テンプレートリテラルの変数が undefined | テンプレート単体テスト（Section 5-1）で検出 |
| 自分の回答に自分が通知される | 自己通知の除外条件が無い | `targetUser.user_id !== currentUser.id` チェック追加 |
| 通知OFF のユーザーに通知される | notification_on_reply チェックが無い | profile の通知設定を確認するコード追加 |
| 退会メールが届かない | アカウント削除後にメール送信している | 削除前に `await sendEmail()` で送信 |
| CF Workers でタイムアウト | メール送信を await で待ちすぎ | fire-and-forget（`.catch(console.error)`）に変更 |
