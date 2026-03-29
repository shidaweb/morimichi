import { siteBaseUrl } from "@/lib/site-base-url";

import { escapeHtml } from "../utils";

export function proApprovedEmail(data: { nickname: string; specialtyName: string }) {
  const base = siteBaseUrl();
  return {
    subject: "【もりみち】公認再生プロに認定されました",
    text: [
      `${data.nickname}さん`,
      "",
      `おめでとうございます。「${data.specialtyName}」の公認再生プロとして認定されました。`,
      "",
      "マイページ: " + base + "/mypage",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">🏆 公認再生プロに認定されました</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          おめでとうございます。<br>
          <strong>${escapeHtml(data.specialtyName)}</strong>の公認再生プロとして認定されました。
        </p>
        <p>これから以下のことが可能になります:</p>
        <ul>
          <li>プロフィールに黄金バッジが表示されます</li>
          <li>コラム記事を投稿できるようになります</li>
          <li>公認再生プロ一覧に掲載されます</li>
          <li>相談者から運営経由の相談リクエストを受け取れます</li>
        </ul>
        <a href="${base}/mypage"
           style="display: inline-block; background: #166534; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 6px; margin-top: 8px;">
          マイページを確認する
        </a>
      </div>
    `,
  };
}
