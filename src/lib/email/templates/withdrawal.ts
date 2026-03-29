import { escapeHtml } from "../utils";

export function withdrawalEmail(data: { nickname: string }) {
  return {
    subject: "【もりみち】退会が完了しました",
    text: [
      `${data.nickname}さん`,
      "",
      "もりみちをご利用いただきありがとうございました。またいつでもお越しください。",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">退会が完了しました</h2>
        <p>${escapeHtml(data.nickname)}さん、</p>
        <p>
          もりみちをご利用いただきありがとうございました。<br>
          またいつでもお越しください。
        </p>
      </div>
    `,
  };
}
