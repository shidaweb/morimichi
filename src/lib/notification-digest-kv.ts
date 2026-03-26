/// <reference types="@cloudflare/workers-types" />

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendReplyNotificationEmail } from "@/lib/email/send-reply-notification";

const PREFIX = "digest:v1:";

type DigestPayload = {
  firstAt: number;
  lastAt: number;
  n: number;
};

export async function enqueueDigestNotification(
  kv: KVNamespace,
  opts: { recipientUserId: string; consultationId: string },
): Promise<void> {
  const key = `${PREFIX}${opts.recipientUserId}:${opts.consultationId}`;
  const now = Date.now();
  const raw = await kv.get(key);
  if (!raw) {
    const payload: DigestPayload = { firstAt: now, lastAt: now, n: 1 };
    await kv.put(key, JSON.stringify(payload), { expirationTtl: 7200 });
    return;
  }
  let prev: DigestPayload;
  try {
    prev = JSON.parse(raw) as DigestPayload;
  } catch {
    const payload: DigestPayload = { firstAt: now, lastAt: now, n: 1 };
    await kv.put(key, JSON.stringify(payload), { expirationTtl: 7200 });
    return;
  }
  const next: DigestPayload = {
    firstAt: prev.firstAt,
    lastAt: now,
    n: prev.n + 1,
  };
  await kv.put(key, JSON.stringify(next), { expirationTtl: 7200 });
}

/**
 * Sends one email per key where the digest window (1 hour from first event) has elapsed.
 */
export async function processDueDigestNotifications(
  kv: KVNamespace,
): Promise<{ processed: number; errors: number }> {
  const now = Date.now();
  let processed = 0;
  let errors = 0;
  let cursor: string | undefined;

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    return { processed: 0, errors: 1 };
  }

  do {
    const list = await kv.list({ prefix: PREFIX, cursor });
    for (const { name } of list.keys) {
      const raw = await kv.get(name);
      if (!raw) {
        await kv.delete(name);
        continue;
      }
      let data: DigestPayload;
      try {
        data = JSON.parse(raw) as DigestPayload;
      } catch {
        await kv.delete(name);
        continue;
      }

      if (now < data.firstAt + 60 * 60 * 1000) {
        continue;
      }

      const withoutPrefix = name.startsWith(PREFIX) ? name.slice(PREFIX.length) : "";
      const colonIdx = withoutPrefix.indexOf(":");
      if (colonIdx === -1) {
        await kv.delete(name);
        continue;
      }
      const recipientUserId = withoutPrefix.slice(0, colonIdx);
      const consultationId = withoutPrefix.slice(colonIdx + 1);
      if (!recipientUserId || !consultationId) {
        await kv.delete(name);
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("notification_on_reply")
        .eq("user_id", recipientUserId)
        .maybeSingle();

      if (!profile?.notification_on_reply) {
        await kv.delete(name);
        continue;
      }

      const { data: authData, error: authErr } =
        await admin.auth.admin.getUserById(recipientUserId);
      const email = authData.user?.email;
      if (!email || authErr) {
        errors += 1;
        continue;
      }

      const result = await sendReplyNotificationEmail({
        to: email,
        consultationId,
      });
      if (result.ok) {
        await kv.delete(name);
        processed += 1;
      } else {
        errors += 1;
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return { processed, errors };
}
