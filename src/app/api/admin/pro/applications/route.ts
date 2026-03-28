import { NextResponse } from "next/server";

import { getModeratorContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  let q = supabase
    .from("pro_applications")
    .select(
      "id, user_id, specialty, application_text, status, reviewer_note, reviewed_at, reviewed_by, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "withdrawn"
  ) {
    q = q.eq("status", status);
  }

  const { data: rows, error } = await q;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const nickByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", userIds);
    for (const p of profs ?? []) nickByUser.set(p.user_id, p.nickname);
  }

  const list = (rows ?? []).map((r) => ({
    ...r,
    nickname: nickByUser.get(r.user_id) ?? "",
  }));

  return NextResponse.json({ applications: list });
}
