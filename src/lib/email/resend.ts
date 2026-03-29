import { Resend } from "resend";

let resendClient: Resend | null = null;

/**
 * Returns a singleton Resend client, or null if RESEND_API_KEY is unset (emails skipped).
 */
export function getResend(): Resend | null {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}
