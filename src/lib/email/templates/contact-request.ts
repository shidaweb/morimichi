import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function contactRequestEmail(data: {
  requesterNickname: string;
  requesterEmail: string;
  targetNickname: string;
  targetSpecialtyName: string;
  subject: string;
  message: string;
  requestId: string;
}) {
  const base = siteBaseUrl();
  const adminUrl = `${base}/admin/contact-requests/${data.requestId}`;

  return {
    subject: `【もりみち】相談リクエスト — ${data.requesterNickname} → ${data.targetNickname}`,
    text: [
      `依頼者: ${data.requesterNickname} (${data.requesterEmail})`,
      `宛先プロ: ${data.targetNickname} (${data.targetSpecialtyName})`,
      `件名: ${data.subject}`,
      "",
      data.message,
      "",
      `管理画面: ${adminUrl}`,
    ].join("\n"),
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
        <a href="${adminUrl}"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          管理画面で確認する
        </a>
      </div>
    `,
  };
}
