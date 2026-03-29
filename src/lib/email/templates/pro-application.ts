import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function proApplicationEmail(data: {
  nickname: string;
  email: string;
  specialtyName: string;
  applicationText: string;
  applicationId: string;
  appliedAt: string;
}) {
  const base = siteBaseUrl();
  const adminUrl = `${base}/admin/pro/applications/${data.applicationId}`;

  return {
    subject: `【もりみち】公認再生プロ申請 — ${data.nickname}（${data.specialtyName}）`,
    text: [
      `ニックネーム: ${data.nickname}`,
      `メール: ${data.email}`,
      `専門分野: ${data.specialtyName}`,
      `申請日時: ${data.appliedAt}`,
      "",
      "申請内容:",
      data.applicationText,
      "",
      `管理画面: ${adminUrl}`,
    ].join("\n"),
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
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(data.appliedAt)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">申請内容</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(data.applicationText)}</td>
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
