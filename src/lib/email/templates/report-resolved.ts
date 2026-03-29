import { escapeHtml } from "../utils";

export function reportResolvedEmail(data: { nickname: string }) {
  return {
    subject: "【もりみち】通報の対応が完了しました",
    text: [
      `${data.nickname}さん`,
      "",
      "ご報告いただいた内容について対応が完了しました。ご協力ありがとうございました。",
      "",
      "※ 対応内容の詳細はプライバシー保護のためお伝えしておりません。",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">通報の対応が完了しました</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          ご報告いただいた内容について対応が完了しました。<br>
          ご協力ありがとうございました。
        </p>
        <p style="font-size: 14px; color: #6b7280;">
          ※ 対応内容の詳細はプライバシー保護のためお伝えしておりません。
        </p>
      </div>
    `,
  };
}
