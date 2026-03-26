import { Resend } from "resend";

function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function sendReplyNotificationEmail(params: {
  to: string;
  consultationId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set; skipping reply notification email");
    return { ok: false, error: "no_api_key" };
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const url = `${siteBaseUrl()}/consultations/${params.consultationId}`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: "【早期事業再生コミュニティ】新しい回答があります",
    text: `新しい回答があります。サイトでご確認ください。\n\n${url}\n\n※本文は通知に含めていません。`,
    html: `<p>新しい回答があります。サイトでご確認ください。</p><p><a href="${url}">${url}</a></p><p style="font-size:12px;color:#666">本文は通知に含めていません。</p>`,
  });

  if (error) {
    console.error("Resend error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
