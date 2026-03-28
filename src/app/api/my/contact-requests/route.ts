import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data: rows, error } = await supabase
    .from("contact_requests")
    .select(
      "id, target_pro_user_id, subject, message, status, created_at, forwarded_at, responded_at",
    )
    .eq("requester_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const targetIds = [...new Set((rows ?? []).map((r) => r.target_pro_user_id))];
  const nickByUser = new Map<string, string>();
  if (targetIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, nickname, pro_specialty")
      .in("user_id", targetIds);
    for (const p of profs ?? []) nickByUser.set(p.user_id, p.nickname);
  }

  const list = (rows ?? []).map((r) => ({
    ...r,
    target_nickname: nickByUser.get(r.target_pro_user_id) ?? "",
  }));

  return NextResponse.json({ requests: list });
}
