import { getResend } from "./resend";

const DEFAULT_FROM = "もりみち <noreply@morimichi.cc>";
const ADMIN_ADDRESS =
  process.env.MORIMICHI_MASTER_EMAIL?.trim() || "master@jugyoin.jp";

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();

  try {
    const resend = getResend();
    if (!resend) {
      console.warn("[Email Skipped]", { to, subject, reason: "RESEND_API_KEY unset" });
      return { success: false, error: "RESEND_API_KEY is not set" };
    }

    console.log("[Email Sending]", {
      to,
      subject,
      timestamp: new Date().toISOString(),
    });

    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: [to],
      subject,
      html,
      ...(text ? { text } : {}),
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.error("[Email FAILED]", {
        to,
        subject,
        error: error.message,
        duration_ms: duration,
      });
      return { success: false, error: error.message };
    }

    console.log("[Email SUCCESS]", {
      to,
      subject,
      resend_id: data?.id,
      duration_ms: duration,
    });
    return { success: true };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error("[Email EXCEPTION]", {
      to,
      subject,
      error: err instanceof Error ? err.message : "Unknown",
      stack: err instanceof Error ? err.stack : undefined,
      duration_ms: duration,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function sendAdminEmail({
  subject,
  html,
  text,
}: Omit<SendEmailParams, "to">): Promise<{ success: boolean; error?: string }> {
  return sendEmail({ to: ADMIN_ADDRESS, subject, html, text });
}
