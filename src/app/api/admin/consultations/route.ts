import { NextResponse } from "next/server";

import { getModeratorContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ContentStatus } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

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

  let q = supabase
    .from("consultations")
    .select("id,title,status,crisis_flag,created_at,reply_count,view_count")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    q = q.eq("status", status as ContentStatus);
  }

  const { data, error } = await q;

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
