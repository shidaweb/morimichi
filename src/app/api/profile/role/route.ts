import { NextResponse } from "next/server";

import { updateProfileRole } from "@/lib/profile/update-profile-role";
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

  const body = json as { role?: unknown };
  const result = await updateProfileRole(supabase, user, body.role);
  if (!result.ok) {
    const forbidden =
      result.message.includes("両方") || result.message.includes("ここから変更できません");
    const status = forbidden ? 403 : 400;
    return NextResponse.json({ error: "update_failed", message: result.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
