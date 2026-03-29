import { escapeHtml } from "../utils";

export function accountWarningEmail(data: { nickname: string; reason: string }) {
  return {
    subject: "【もりみち】アカウントに関するお知らせ",
    text: [
      `${data.nickname}さん`,
      "",
      "あなたのアカウントに関して、以下のお知らせがあります。",
      "",
      data.reason,
      "",
      "利用規約に沿ったご利用をお願いいたします。",
    ].join("\n"),
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
  };
}
