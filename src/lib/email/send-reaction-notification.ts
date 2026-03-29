import { sendEmail } from "@/lib/email/send";
import { reactionNotificationEmail } from "@/lib/email/templates/reaction-notification";

export async function sendReactionNotificationEmail(params: {
  to: string;
  consultationId: string;
  consultationTitle: string;
  recipientNickname: string;
  reactionCount: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = reactionNotificationEmail({
    recipientNickname: params.recipientNickname,
    consultationTitle: params.consultationTitle,
    consultationId: params.consultationId,
    reactionCount: params.reactionCount,
  });

  const result = await sendEmail({
    to: params.to,
    subject,
    html,
    text,
  });

  return result.success
    ? { ok: true }
    : { ok: false, error: result.error ?? "send_failed" };
}
