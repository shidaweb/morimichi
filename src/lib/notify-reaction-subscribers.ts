import type { SupabaseClient } from "@supabase/supabase-js";

import { sendReactionNotificationEmail } from "@/lib/email/send-reaction-notification";
import { getRateLimitKv } from "@/lib/cloudflare/kv";
import { enqueueReactionDigestNotification } from "@/lib/reaction-digest-kv";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, ReactionTarget } from "@/types/database";

/**
 * After a new empathy reaction is created (not removed).
 * Respects notification_on_reaction and notification_digest.
 */
export async function notifyReactionCreated(params: {
  supabase: SupabaseClient<Database>;
  targetType: ReactionTarget;
  targetId: string;
  actorUserId: string;
}): Promise<void> {
  const { supabase, targetType, targetId, actorUserId } = params;

  let authorUserId: string | null = null;
  let consultationId: string | null = null;

  if (targetType === "consultation") {
    const { data: c } = await supabase
      .from("consultations")
      .select("user_id, id")
      .eq("id", targetId)
      .maybeSingle();
    authorUserId = c?.user_id ?? null;
    consultationId = c?.id ?? null;
  } else {
    const { data: r } = await supabase
      .from("replies")
      .select("user_id, consultation_id")
      .eq("id", targetId)
      .maybeSingle();
    authorUserId = r?.user_id ?? null;
    consultationId = r?.consultation_id ?? null;
  }

  if (!authorUserId || !consultationId || authorUserId === actorUserId) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_on_reaction, notification_digest, nickname")
    .eq("user_id", authorUserId)
    .maybeSingle();

  if (!profile?.notification_on_reaction) {
    return;
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    console.warn(
      "notifyReactionCreated: SUPABASE_SERVICE_ROLE_KEY missing; skip email",
    );
    return;
  }

  const { data: authData, error: authErr } =
    await admin.auth.admin.getUserById(authorUserId);
  const email = authData.user?.email;
  if (!email || authErr) {
    return;
  }

  const { data: consultation } = await admin
    .from("consultations")
    .select("title")
    .eq("id", consultationId)
    .maybeSingle();

  const consultationTitle = consultation?.title ?? "（無題）";
  const recipientNickname = profile.nickname ?? "ご利用者";

  const useDigest = profile.notification_digest === true;
  const kv = await getRateLimitKv();

  if (useDigest && kv) {
    await enqueueReactionDigestNotification(kv, {
      recipientUserId: authorUserId,
      consultationId,
    });
    return;
  }

  await sendReactionNotificationEmail({
    to: email,
    consultationId,
    consultationTitle,
    recipientNickname,
    reactionCount: 1,
  }).catch(console.error);
}
