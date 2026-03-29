import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export type ReplyNotificationKind =
  | "reply_to_consultation"
  | "reply_to_answer"
  | "reply_to_nested";

function typeHeadline(kind: ReplyNotificationKind): string {
  switch (kind) {
    case "reply_to_consultation":
      return "あなたの相談に回答がありました";
    case "reply_to_answer":
      return "あなたの回答に返信がありました";
    case "reply_to_nested":
      return "あなたの返信に回答がありました";
    default:
      return "あなたの相談に回答がありました";
  }
}

export function replyNotificationEmail(data: {
  recipientNickname: string;
  notificationKind: ReplyNotificationKind;
  consultationTitle: string;
  consultationId: string;
  replyCount: number;
}) {
  const headline = typeHeadline(data.notificationKind);
  const base = siteBaseUrl();
  const url = `${base}/consultations/${data.consultationId}`;

  return {
    subject: `【もりみち】${headline}`,
    text: [
      `${data.recipientNickname}さん`,
      "",
      `「${data.consultationTitle}」に${
        data.replyCount > 1 ? `${data.replyCount}件の` : ""
      }新しい回答があります。`,
      "",
      "※ 匿名性保護のため、回答の内容はメールに含めていません。サイトでご確認ください。",
      url,
      "",
      "通知設定: " + `${base}/mypage`,
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">${escapeHtml(headline)}</h2>
        <p>${escapeHtml(data.recipientNickname)}さん、</p>
        <p>
          「${escapeHtml(data.consultationTitle)}」に
          ${data.replyCount > 1 ? `${data.replyCount}件の` : ""}新しい回答があります。
        </p>
        <p>
          ※ 匿名性保護のため、回答の内容はメールに含めていません。<br>
          サイトでご確認ください。
        </p>
        <a href="${url}"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          回答を確認する
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
