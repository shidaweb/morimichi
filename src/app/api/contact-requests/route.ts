import { NextResponse } from "next/server";

import { sendContactRequestNotifyToMaster } from "@/lib/email/certified-pro-mail";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthUserEmailById } from "@/lib/supabase/auth-user-email";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

const ADVISOR_ROLES: UserRole[] = ["advisor", "both", "admin"];

function isAdvisorRole(role: string | null | undefined): role is UserRole {
  return role !== undefined && role !== null && ADVISOR_ROLES.includes(role as UserRole);
}

export async function POST(request: Request) {
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

  const rl = await checkRateLimit({
    key: `contact_req:${user.id}`,
    limit: 3,
    windowSeconds: 86_400,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";

  const targetUserIdRaw = o.target_user_id;
  const targetNicknameRaw = o.target_pro_nickname;

  let targetUserId: string | null = null;
  if (typeof targetUserIdRaw === "string" && targetUserIdRaw.length > 0) {
    targetUserId = targetUserIdRaw.trim();
  }

  const targetNicknameFromBody =
    typeof targetNicknameRaw === "string" ? targetNicknameRaw.trim() : "";

  if (subject.length < 1 || subject.length > 100) {
    return NextResponse.json({ error: "invalid_subject" }, { status: 400 });
  }

  if (message.length < 1 || message.length > 2000) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  const { data: requester } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  let target:
    | {
        user_id: string;
        nickname: string;
        pro_specialty: string | null;
        is_certified_pro: boolean | null;
        role: string;
      }
    | undefined;

  if (targetUserId) {
    const { data: t } = await supabase
      .from("profiles")
      .select("user_id, nickname, pro_specialty, is_certified_pro, role")
      .eq("user_id", targetUserId)
      .maybeSingle();
    target = t ?? undefined;
  } else if (targetNicknameFromBody.length > 0) {
    const { data: t } = await supabase
      .from("profiles")
      .select("user_id, nickname, pro_specialty, is_certified_pro, role")
      .eq("nickname", targetNicknameFromBody)
      .maybeSingle();
    target = t ?? undefined;
    targetUserId = target?.user_id ?? null;
  } else {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  if (!target || !targetUserId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!isAdvisorRole(target.role)) {
    return NextResponse.json({ error: "target_not_advisor" }, { status: 400 });
  }

  if (target.user_id === user.id) {
    return NextResponse.json({ error: "cannot_contact_self" }, { status: 400 });
  }

  let targetSpecialtyName: string | null = null;
  if (target.is_certified_pro && target.pro_specialty) {
    const { data: spec } = await supabase
      .from("pro_specialties")
      .select("name")
      .eq("slug", target.pro_specialty)
      .maybeSingle();
    targetSpecialtyName = spec?.name ?? target.pro_specialty;
  }

  const { data: row, error } = await supabase
    .from("contact_requests")
    .insert({
      requester_user_id: user.id,
      target_user_id: targetUserId,
      subject,
      message,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const requesterEmail =
    user.email ?? (await getAuthUserEmailById(user.id)) ?? "(不明)";

  await sendContactRequestNotifyToMaster({
    requesterNickname: requester?.nickname ?? "(不明)",
    requesterEmail,
    targetNickname: target.nickname,
    targetSpecialtyName,
    targetIsCertifiedPro: Boolean(target.is_certified_pro),
    subject,
    message,
    requestId: row!.id,
  }).catch(console.error);

  return NextResponse.json({
    id: row!.id,
    message: "相談リクエストを送信しました。運営が確認の上、おつなぎいたします。",
  });
}
