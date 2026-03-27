import { NextResponse } from "next/server";

import { getModeratorContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,nickname,role,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}
