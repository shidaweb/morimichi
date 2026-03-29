import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function welcomeEmail(data: { nickname: string; role: string }) {
  const roleText =
    data.role === "consulter"
      ? "相談者"
      : data.role === "advisor"
        ? "回答者"
        : data.role === "both"
          ? "相談者・回答者"
          : "相談者・回答者";

  const base = siteBaseUrl();
  return {
    subject: "【もりみち】ご登録ありがとうございます",
    text: [
      `${data.nickname}さん`,
      "",
      `「${roleText}」としてのご登録ありがとうございます。`,
      "",
      base,
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">もりみちへようこそ</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          「${escapeHtml(roleText)}」としてのご登録ありがとうございます。<br>
          経営のしんどさを、一人で抱え込まなくてよい場所です。
        </p>
        <a href="${base}"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          もりみちを見る
        </a>
      </div>
    `,
  };
}
