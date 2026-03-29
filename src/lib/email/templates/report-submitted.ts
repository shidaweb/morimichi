import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function reportSubmittedEmail(data: {
  reporterNickname: string;
  targetType: "consultation" | "reply";
  targetTitle: string;
  reason: string;
  detail: string | null;
  reportId: string;
}) {
  const base = siteBaseUrl();
  const label = data.targetType === "consultation" ? "相談" : "返信";
  const titleShort =
    data.targetTitle.length > 30 ? data.targetTitle.slice(0, 30) + "…" : data.targetTitle;
  const adminUrl = `${base}/admin/reports/${data.reportId}`;

  return {
    subject: `【もりみち】通報 — ${label}: ${titleShort}`,
    text: [
      `通報者: ${data.reporterNickname}`,
      `対象: ${label}: ${data.targetTitle}`,
      `理由: ${data.reason}`,
      data.detail ? `詳細: ${data.detail}` : "",
      "",
      `管理画面: ${adminUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
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
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${label}: ${escapeHtml(data.targetTitle)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">通報理由</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.reason)}</td>
          </tr>
          ${
            data.detail
              ? `<tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">詳細</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(data.detail)}</td>
          </tr>`
              : ""
          }
        </table>
        <a href="${adminUrl}"
           style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          管理画面で確認する
        </a>
      </div>
    `,
  };
}
