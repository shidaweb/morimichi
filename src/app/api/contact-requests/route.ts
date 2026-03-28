import { NextResponse } from "next/server";

import { sendContactRequestNotifyToMaster } from "@/lib/email/certified-pro-mail";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthUserEmailById } from "@/lib/supabase/auth-user-email";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProSpecialty } from "@/types/database";

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
  const targetNickname =
    typeof o.target_pro_nickname === "string" ? o.target_pro_nickname.trim() : "";
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";

  if (targetNickname.length < 1) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

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

  const { data: target } = await supabase
    .from("profiles")
    .select("user_id, nickname, pro_specialty, is_certified_pro")
    .eq("nickname", targetNickname)
    .maybeSingle();

  if (!target?.is_certified_pro || !target.pro_specialty) {
    return NextResponse.json({ error: "target_not_pro" }, { status: 400 });
  }

  if (target.user_id === user.id) {
    return NextResponse.json({ error: "cannot_contact_self" }, { status: 400 });
  }

  const { data: spec } = await supabase
    .from("pro_specialties")
    .select("name")
    .eq("slug", target.pro_specialty as ProSpecialty)
    .maybeSingle();

  const targetSpecialtyName = spec?.name ?? target.pro_specialty;

  const { data: row, error } = await supabase
    .from("contact_requests")
    .insert({
      requester_user_id: user.id,
      target_pro_user_id: target.user_id,
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

  void sendContactRequestNotifyToMaster({
    requesterNickname: requester?.nickname ?? "(不明)",
    requesterEmail,
    targetNickname: target.nickname,
    targetSpecialtyName,
    subject,
    message,
    requestId: row!.id,
  });

  return NextResponse.json({
    id: row!.id,
    message: "相談リクエストを送信しました。運営が確認の上、おつなぎいたします。",
  });
}
