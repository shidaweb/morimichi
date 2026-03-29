import { NextResponse } from "next/server";
import { z } from "zod";

import { getModeratorContext } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email/send";
import { accountWarningEmail } from "@/lib/email/templates/account-warning";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ModerationActionType } from "@/types/database";

const bodySchema = z.object({
  targetType: z.enum(["consultation", "reply"]),
  targetId: z.string().uuid(),
  action: z.enum(["hide", "delete", "warn"]),
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

  if (action === "warn") {
    let authorUserId: string | null = null;
    if (targetType === "consultation") {
      const { data: c } = await supabase
        .from("consultations")
        .select("user_id")
        .eq("id", targetId)
        .maybeSingle();
      authorUserId = c?.user_id ?? null;
    } else {
      const { data: r } = await supabase
        .from("replies")
        .select("user_id")
        .eq("id", targetId)
        .maybeSingle();
      authorUserId = r?.user_id ?? null;
    }

    if (!authorUserId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { error: logErr } = await supabase.from("moderation_actions").insert({
      moderator_user_id: mod.userId,
      report_id: reportId ?? null,
      target_type: targetType,
      target_id: targetId,
      action: "warn" satisfies ModerationActionType,
      note: note?.trim() || null,
    });

    if (logErr) {
      console.error(logErr);
      return NextResponse.json({ error: "log_failed" }, { status: 500 });
    }

    const reasonText =
      note?.trim() || "利用規約に抵触する投稿がありました。";

    try {
      const admin = createAdminSupabaseClient();
      const { data: prof } = await admin
        .from("profiles")
        .select("nickname")
        .eq("user_id", authorUserId)
        .maybeSingle();
      const { data: authData } = await admin.auth.admin.getUserById(authorUserId);
      const to = authData.user?.email;
      if (to) {
        const { subject, html, text } = accountWarningEmail({
          nickname: prof?.nickname ?? "ご利用者",
          reason: reasonText,
        });
        await sendEmail({ to, subject, html, text }).catch(console.error);
      }
    } catch (e) {
      console.error("account warning email skipped:", e);
    }

    return NextResponse.json({ ok: true });
  }

  const nextStatus = action === "hide" ? ("hidden" as const) : ("deleted" as const);

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
