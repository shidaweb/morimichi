import type { SupabaseClient } from "@supabase/supabase-js";

import { sendAdminEmail } from "@/lib/email/send";
import { contactInfoAutoFlagEmail } from "@/lib/email/templates/contact-info-auto-flag";
import { detectContactInfo } from "@/lib/utils/content-filter";
import type { Database } from "@/types/database";

/**
 * 本文に連絡先らしき文字列があっても投稿は成功済みとし、
 * 自動通報レコードと運営メールでフォローする（Phase 4）。
 */
export async function autoFlagContactInContent(params: {
  supabase: SupabaseClient<Database>;
  authorUserId: string;
  authorNickname: string;
  targetType: "consultation" | "reply";
  targetId: string;
  text: string;
}): Promise<void> {
  const { hasContactInfo, matches } = detectContactInfo(params.text);
  if (!hasContactInfo || matches.length === 0) return;

  const { error } = await params.supabase.from("reports").insert({
    reporter_user_id: params.authorUserId,
    target_type: params.targetType,
    target_id: params.targetId,
    reason: "auto_detected_contact_info",
    detail: matches.slice(0, 20).join("\n"),
    status: "pending",
  });
  if (error) {
    console.error("autoFlagContactInContent: report insert failed", error);
    return;
  }

  const email = contactInfoAutoFlagEmail({
    targetType: params.targetType,
    targetId: params.targetId,
    authorNickname: params.authorNickname,
    matches,
  });
  await sendAdminEmail(email).catch(console.error);
}
