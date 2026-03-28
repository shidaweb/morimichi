import { NextResponse } from "next/server";

import {
  sendProApplicationNotifyToMaster,
} from "@/lib/email/certified-pro-mail";
import { isProSpecialty } from "@/lib/pro/pro-specialty";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthUserEmailById } from "@/lib/supabase/auth-user-email";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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
    key: `pro_apply:${user.id}`,
    limit: 1,
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
  const specialty = o.specialty;
  const applicationText =
    typeof o.application_text === "string" ? o.application_text.trim() : "";

  if (!isProSpecialty(specialty)) {
    return NextResponse.json({ error: "invalid_specialty" }, { status: 400 });
  }

  if (applicationText.length < 10 || applicationText.length > 1000) {
    return NextResponse.json(
      { error: "invalid_application_text", message: "10〜1000文字で入力してください" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (role !== "advisor" && role !== "both" && role !== "admin") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }

  const { data: specRow } = await supabase
    .from("pro_specialties")
    .select("name")
    .eq("slug", specialty)
    .maybeSingle();

  const specialtyName = specRow?.name ?? specialty;

  const insert: Database["public"]["Tables"]["pro_applications"]["Insert"] = {
    user_id: user.id,
    specialty,
    application_text: applicationText,
    status: "pending",
  };

  const { data: row, error } = await supabase
    .from("pro_applications")
    .insert(insert)
    .select("id, status, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "duplicate_application", message: "既に審査中または認定済みの申請があります" },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const email =
    user.email ??
    (await getAuthUserEmailById(user.id)) ??
    "(メール取得不可)";

  void sendProApplicationNotifyToMaster({
    nickname: profile?.nickname ?? "(不明)",
    email,
    specialtyName,
    applicationText,
    applicationId: row!.id,
  });

  return NextResponse.json({
    id: row!.id,
    status: row!.status,
    message: "公認再生プロ申請を受け付けました。運営からのお返事をお待ちください。",
  });
}
