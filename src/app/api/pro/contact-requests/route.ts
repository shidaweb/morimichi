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

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_certified_pro")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_certified_pro) {
    return NextResponse.json({ error: "forbidden_not_pro" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("contact_requests")
    .select(
      "id, requester_user_id, subject, message, status, created_at, forwarded_at, responded_at",
    )
    .eq("target_user_id", user.id)
    .in("status", ["forwarded", "responded", "closed"])
    .order("forwarded_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const requesterIds = [...new Set((rows ?? []).map((r) => r.requester_user_id))];
  const nickByUser = new Map<string, string>();
  if (requesterIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", requesterIds);
    for (const p of profs ?? []) nickByUser.set(p.user_id, p.nickname);
  }

  const list = (rows ?? []).map((r) => ({
    ...r,
    requester_nickname: nickByUser.get(r.requester_user_id) ?? "",
  }));

  return NextResponse.json({ requests: list });
}
