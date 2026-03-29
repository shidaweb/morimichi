import { NextResponse } from "next/server";

import { getRateLimitKv } from "@/lib/cloudflare/kv";
import { processDueDigestNotifications } from "@/lib/notification-digest-kv";
import { processDueReactionDigestNotifications } from "@/lib/reaction-digest-kv";

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return false;
  }
  const bearer =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const header = request.headers.get("x-cron-secret") ?? "";
  return bearer === expected || header === expected;
}

/**
 * Processes KV-backed email digests (1-hour window per recipient/thread).
 * Schedule via Cloudflare Cron Triggers or an external scheduler (e.g. every 5–10 minutes).
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const kv = await getRateLimitKv();
  if (!kv) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "kv_unavailable",
    });
  }

  const replies = await processDueDigestNotifications(kv);
  const reactions = await processDueReactionDigestNotifications(kv);
  return NextResponse.json({
    ok: true,
    replies,
    reactions,
    processed: replies.processed + reactions.processed,
    errors: replies.errors + reactions.errors,
  });
}
