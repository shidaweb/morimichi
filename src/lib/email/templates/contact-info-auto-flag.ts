import { escapeHtml } from "../utils";

export function contactInfoAutoFlagEmail(data: {
  targetType: "consultation" | "reply";
  targetId: string;
  authorNickname: string;
  matches: string[];
}) {
  const subj = "【もりみち】連絡先情報検出 — 自動フラグ";
  const lines = [
    `対象種別: ${data.targetType}`,
    `対象ID: ${data.targetId}`,
    `投稿者ニックネーム: ${data.authorNickname}`,
    `検出パターン: ${data.matches.join(" | ")}`,
  ];
  return {
    subject: subj,
    text: lines.join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #b45309;">連絡先情報の自動検出</h2>
        <p><strong>対象</strong> ${escapeHtml(data.targetType)} / ${escapeHtml(data.targetId)}</p>
        <p><strong>投稿者</strong> ${escapeHtml(data.authorNickname)}</p>
        <p><strong>検出</strong></p>
        <pre style="white-space:pre-wrap;background:#fef3c7;padding:12px;border-radius:8px;">${escapeHtml(data.matches.join("\n"))}</pre>
      </div>
    `,
  };
}
