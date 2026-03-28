import { Resend } from "resend";

import { siteBaseUrl } from "@/lib/site-base-url";

const MASTER =
  process.env.MORIMICHI_MASTER_EMAIL?.trim() || "master@jugyoin.jp";

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
}

async function send(html: string, text: string, to: string, subject: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set; skipping email");
    return { ok: false as const, error: "no_api_key" };
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject,
    html,
    text,
  });
  if (error) {
    console.error("Resend error:", error);
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export async function sendProApplicationNotifyToMaster(data: {
  nickname: string;
  email: string;
  specialtyName: string;
  applicationText: string;
  applicationId: string;
}) {
  const adminUrl = `${siteBaseUrl()}/admin/pro/applications`;
  const subject = `【もりみち】公認再生プロ申請 — ${data.nickname}（${data.specialtyName}）`;
  const text = [
    `ニックネーム: ${data.nickname}`,
    `メール: ${data.email}`,
    `専門分野: ${data.specialtyName}`,
    `申請ID: ${data.applicationId}`,
    "",
    "申請内容:",
    data.applicationText,
    "",
    `管理画面: ${adminUrl}`,
  ].join("\n");
  const html = `
    <h2>公認再生プロ申請</h2>
    <p><strong>ニックネーム</strong> ${escapeHtml(data.nickname)}</p>
    <p><strong>メール</strong> ${escapeHtml(data.email)}</p>
    <p><strong>専門分野</strong> ${escapeHtml(data.specialtyName)}</p>
    <p><strong>申請ID</strong> ${escapeHtml(data.applicationId)}</p>
    <h3>申請内容</h3>
    <pre style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(data.applicationText)}</pre>
    <p><a href="${adminUrl}">管理画面で確認する</a></p>
  `;
  return send(html, text, MASTER, subject);
}

export async function sendProApplicationApprovedToUser(to: string) {
  const subject = "【もりみち】公認再生プロに認定されました";
  const text =
    "おめでとうございます。公認再生プロに認定されました。コラム記事の投稿などが可能になりました。\n\nもりみち";
  const html = `<p>おめでとうございます。公認再生プロに認定されました。コラム記事の投稿などが可能になりました。</p><p>もりみち</p>`;
  return send(html, text, to, subject);
}

export async function sendProApplicationRejectedToUser(to: string) {
  const subject = "【もりみち】公認再生プロ申請について";
  const text =
    "申請内容を確認いたしましたが、現時点ではお見送りとなりました。再度お申し込みいただくことも可能です。\n\nもりみち";
  const html = `<p>申請内容を確認いたしましたが、現時点ではお見送りとなりました。再度お申し込みいただくことも可能です。</p><p>もりみち</p>`;
  return send(html, text, to, subject);
}

export async function sendContactRequestNotifyToMaster(data: {
  requesterNickname: string;
  requesterEmail: string;
  targetNickname: string;
  targetSpecialtyName: string;
  subject: string;
  message: string;
  requestId: string;
}) {
  const adminUrl = `${siteBaseUrl()}/admin/contact-requests`;
  const subj = `【もりみち】相談リクエスト — ${data.requesterNickname} → ${data.targetNickname}`;
  const text = [
    `依頼者: ${data.requesterNickname} (${data.requesterEmail})`,
    `宛先プロ: ${data.targetNickname} (${data.targetSpecialtyName})`,
    `件名: ${data.subject}`,
    `リクエストID: ${data.requestId}`,
    "",
    data.message,
    "",
    `管理画面: ${adminUrl}`,
  ].join("\n");
  const html = `
    <h2>相談リクエスト</h2>
    <p><strong>依頼者</strong> ${escapeHtml(data.requesterNickname)}（${escapeHtml(data.requesterEmail)}）</p>
    <p><strong>宛先プロ</strong> ${escapeHtml(data.targetNickname)}（${escapeHtml(data.targetSpecialtyName)}）</p>
    <p><strong>件名</strong> ${escapeHtml(data.subject)}</p>
    <p><strong>ID</strong> ${escapeHtml(data.requestId)}</p>
    <h3>内容</h3>
    <pre style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(data.message)}</pre>
    <p><a href="${adminUrl}">管理画面</a></p>
  `;
  return send(html, text, MASTER, subj);
}

export async function sendContactRequestForwardedToPro(data: {
  to: string;
  subjectLine: string;
  message: string;
  requesterNickname: string;
}) {
  const subject = "【もりみち】相談リクエストが届いています";
  const text = [
    `${data.requesterNickname} さんから相談リクエストが運営経由で転送されました。`,
    "",
    `件名: ${data.subjectLine}`,
    "",
    data.message,
    "",
    "サイトにログインし、マイページからご確認ください。",
  ].join("\n");
  const html = `
    <p>${escapeHtml(data.requesterNickname)} さんから相談リクエストが運営経由で転送されました。</p>
    <p><strong>件名</strong> ${escapeHtml(data.subjectLine)}</p>
    <pre style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(data.message)}</pre>
    <p>サイトにログインし、マイページからご確認ください。</p>
  `;
  return send(html, text, data.to, subject);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
