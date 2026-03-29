import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function proRejectedEmail(data: { nickname: string }) {
  const base = siteBaseUrl();
  return {
    subject: "【もりみち】公認再生プロ申請について",
    text: [
      `${data.nickname}さん`,
      "",
      "公認再生プロの申請内容を確認いたしましたが、現時点ではお見送りとさせていただきました。",
      "再度申請いただくことも可能です。",
      "",
      base + "/mypage",
    ].join("\n"),
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
        <a href="${base}/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          マイページへ
        </a>
      </div>
    `,
  };
}
