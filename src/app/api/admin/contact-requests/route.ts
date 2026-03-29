import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const admin = await getAdminContext(supabase);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const uids = new Set<string>();
  for (const r of rows ?? []) {
    uids.add(r.requester_user_id);
    uids.add(r.target_user_id);
  }

  const nickByUser = new Map<string, string>();
  if (uids.size > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", [...uids]);
    for (const p of profs ?? []) nickByUser.set(p.user_id, p.nickname);
  }

  const list = (rows ?? []).map((r) => ({
    ...r,
    requester_nickname: nickByUser.get(r.requester_user_id) ?? "",
    target_nickname: nickByUser.get(r.target_user_id) ?? "",
  }));

  return NextResponse.json({ requests: list });
}
