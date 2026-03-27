import { NextResponse } from "next/server";
import { z } from "zod";

import { getModeratorContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ModerationActionType } from "@/types/database";

const bodySchema = z.object({
  targetType: z.enum(["consultation", "reply"]),
  targetId: z.string().uuid(),
  action: z.enum(["hide", "delete"]),
  reportId: z.string().uuid().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const mod = await getModeratorContext(supabase);
  if (!mod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

  const { targetType, targetId, action, reportId, note } = parsed.data;
  const nextStatus =
    action === "hide"
      ? ("hidden" as const)
      : ("deleted" as const);

  const modAction: ModerationActionType = action === "hide" ? "hide" : "delete";

  if (targetType === "consultation") {
    const { error: uErr } = await supabase
      .from("consultations")
      .update({ status: nextStatus })
      .eq("id", targetId);
    if (uErr) {
      console.error(uErr);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
  } else {
    const { error: uErr } = await supabase
      .from("replies")
      .update({ status: nextStatus })
      .eq("id", targetId);
    if (uErr) {
      console.error(uErr);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
  }

  const { error: logErr } = await supabase.from("moderation_actions").insert({
    moderator_user_id: mod.userId,
    report_id: reportId ?? null,
    target_type: targetType,
    target_id: targetId,
    action: modAction,
    note: note?.trim() || null,
  });

  if (logErr) {
    console.error(logErr);
    return NextResponse.json({ error: "log_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
