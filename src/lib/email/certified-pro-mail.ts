import { sendAdminEmail, sendEmail } from "@/lib/email/send";
import { contactForwardedEmail } from "@/lib/email/templates/contact-forwarded";
import { contactRequestEmail } from "@/lib/email/templates/contact-request";
import { proApplicationEmail } from "@/lib/email/templates/pro-application";
import { proApprovedEmail } from "@/lib/email/templates/pro-approved";
import { proRejectedEmail } from "@/lib/email/templates/pro-rejected";

export async function sendProApplicationNotifyToMaster(data: {
  nickname: string;
  email: string;
  specialtyName: string;
  applicationText: string;
  applicationId: string;
}) {
  const appliedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const { subject, html, text } = proApplicationEmail({
    ...data,
    appliedAt,
  });
  const result = await sendAdminEmail({ subject, html, text });
  if (!result.success) {
    console.error("CRITICAL: Pro application email failed!", result.error);
  }
  return result.success ? { ok: true as const } : { ok: false as const, error: result.error };
}

export async function sendProApplicationApprovedToUser(
  to: string,
  data: { nickname: string; specialtyName: string },
) {
  const { subject, html, text } = proApprovedEmail(data);
  return sendEmail({ to, subject, html, text }).then((r) =>
    r.success ? { ok: true as const } : { ok: false as const, error: r.error },
  );
}

export async function sendProApplicationRejectedToUser(to: string, data: { nickname: string }) {
  const { subject, html, text } = proRejectedEmail(data);
  return sendEmail({ to, subject, html, text }).then((r) =>
    r.success ? { ok: true as const } : { ok: false as const, error: r.error },
  );
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
  const { subject, html, text } = contactRequestEmail(data);
  const result = await sendAdminEmail({ subject, html, text });
  return result.success ? { ok: true as const } : { ok: false as const, error: result.error };
}

export async function sendContactRequestForwardedToPro(data: {
  to: string;
  subjectLine: string;
  message: string;
  requesterNickname: string;
  proNickname: string;
}) {
  const { subject, html, text } = contactForwardedEmail({
    proNickname: data.proNickname,
    requesterNickname: data.requesterNickname,
    subject: data.subjectLine,
    message: data.message,
  });
  const result = await sendEmail({ to: data.to, subject, html, text });
  return result.success ? { ok: true as const } : { ok: false as const, error: result.error };
}
