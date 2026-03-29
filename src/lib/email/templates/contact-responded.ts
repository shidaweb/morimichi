import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function contactRespondedEmail(data: {
  requesterNickname: string;
  proNickname: string;
}) {
  const base = siteBaseUrl();
  return {
    subject: "【もりみち】相談リクエストへの回答が届きました",
    text: [
      `${data.requesterNickname}さん`,
      "",
      `${data.proNickname}さんからの回答が届いています。マイページからご確認ください。`,
      "",
      base + "/mypage",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">相談リクエストへの回答が届きました</h2>
        <p>${escapeHtml(data.requesterNickname)}さん、</p>
        <p>
          ${escapeHtml(data.proNickname)}さんからの回答が届いています。<br>
          マイページからご確認ください。
        </p>
        <a href="${base}/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          回答を確認する
        </a>
      </div>
    `,
  };
}
