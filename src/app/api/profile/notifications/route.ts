import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z
  .object({
    notificationOnReply: z.boolean().optional(),
    notificationOnReaction: z.boolean().optional(),
    notificationDigest: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.notificationOnReply !== undefined ||
      d.notificationOnReaction !== undefined ||
      d.notificationDigest !== undefined,
    { message: "no_fields" },
  );

export async function PATCH(request: Request) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const row: Record<string, boolean> = {};
  if (parsed.data.notificationOnReply !== undefined) {
    row.notification_on_reply = parsed.data.notificationOnReply;
  }
  if (parsed.data.notificationOnReaction !== undefined) {
    row.notification_on_reaction = parsed.data.notificationOnReaction;
  }
  if (parsed.data.notificationDigest !== undefined) {
    row.notification_digest = parsed.data.notificationDigest;
  }

  const { error } = await supabase
    .from("profiles")
    .update(row)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
