import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function contactForwardedEmail(data: {
  proNickname: string;
  requesterNickname: string;
  subject: string;
  message: string;
}) {
  const base = siteBaseUrl();
  return {
    subject: "【もりみち】相談リクエストが届いています",
    text: [
      `${data.proNickname}さん`,
      "",
      `${data.requesterNickname}さんから運営経由で相談リクエストが届いています。`,
      "",
      `件名: ${data.subject}`,
      "",
      data.message,
      "",
      "マイページ: " + base + "/mypage",
    ].join("\n"),
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
        <a href="${base}/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          マイページで確認する
        </a>
      </div>
    `,
  };
}
