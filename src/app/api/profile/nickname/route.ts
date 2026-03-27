import { NextResponse } from "next/server";

import { updateProfileNickname } from "@/lib/profile/update-profile-nickname";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const body = json as { nickname?: unknown };
  const nicknameRaw = typeof body.nickname === "string" ? body.nickname : "";

  const result = await updateProfileNickname(supabase, user, nicknameRaw);
  if (!result.ok) {
    let status: number = 400;
    if (result.message.includes("すでに")) status = 409;
    else if (
      result.message.includes("プロフィール") ||
      result.message.includes("保存に失敗")
    ) {
      status = 500;
    }
    return NextResponse.json({ error: "update_failed", message: result.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
