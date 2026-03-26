import type { SupabaseClient } from "@supabase/supabase-js";

import { sendReplyNotificationEmail } from "@/lib/email/send-reply-notification";
import { getRateLimitKv } from "@/lib/cloudflare/kv";
import { enqueueDigestNotification } from "@/lib/notification-digest-kv";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Fire-and-forget email notifications after a published reply is created.
 * Respects profiles.notification_on_reply and notification_digest.
 */
export async function notifyReplyCreated(params: {
  supabase: SupabaseClient<Database>;
  consultationId: string;
  depth: number;
  parentReplyId: string | null;
  authorUserId: string;
}): Promise<void> {
  const { supabase, consultationId, depth, parentReplyId, authorUserId } =
    params;

  let recipientUserId: string | null = null;

  if (depth === 1) {
    const { data: c } = await supabase
      .from("consultations")
      .select("user_id")
      .eq("id", consultationId)
      .maybeSingle();
    recipientUserId = c?.user_id ?? null;
  } else if (parentReplyId) {
    const { data: p } = await supabase
      .from("replies")
      .select("user_id")
      .eq("id", parentReplyId)
      .maybeSingle();
    recipientUserId = p?.user_id ?? null;
  }

  if (!recipientUserId || recipientUserId === authorUserId) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_on_reply, notification_digest")
    .eq("user_id", recipientUserId)
    .maybeSingle();

  if (!profile?.notification_on_reply) {
    return;
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    console.warn(
      "notifyReplyCreated: SUPABASE_SERVICE_ROLE_KEY missing; skip email",
    );
    return;
  }

  const { data: authData, error: authErr } =
    await admin.auth.admin.getUserById(recipientUserId);
  const email = authData.user?.email;
  if (!email || authErr) {
    return;
  }

  const useDigest = profile.notification_digest === true;
  const kv = await getRateLimitKv();

  if (useDigest && kv) {
    await enqueueDigestNotification(kv, {
      recipientUserId,
      consultationId,
    });
    return;
  }

  await sendReplyNotificationEmail({ to: email, consultationId });
}
