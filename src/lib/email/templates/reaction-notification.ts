import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function reactionNotificationEmail(data: {
  recipientNickname: string;
  consultationTitle: string;
  consultationId: string;
  reactionCount: number;
}) {
  const base = siteBaseUrl();
  const url = `${base}/consultations/${data.consultationId}`;

  return {
    subject: "【もりみち】あなたの投稿に共感がありました",
    text: [
      `${data.recipientNickname}さん`,
      "",
      `「${data.consultationTitle}」の投稿に${
        data.reactionCount > 1 ? `${data.reactionCount}件の` : ""
      }共感がありました。`,
      "",
      "サイトでご確認ください。",
      url,
      "",
      "通知設定: " + `${base}/mypage`,
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">あなたの投稿に共感がありました</h2>
        <p>${escapeHtml(data.recipientNickname)}さん、</p>
        <p>
          「${escapeHtml(data.consultationTitle)}」に
          ${data.reactionCount > 1 ? `${data.reactionCount}件の` : ""}共感がありました。
        </p>
        <p>サイトでご確認ください。</p>
        <a href="${url}"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          投稿を見る
        </a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          この通知が不要な場合は
          <a href="${base}/mypage" style="color: #6b7280;">マイページの通知設定</a>
          から変更できます。
        </p>
      </div>
    `,
  };
}
