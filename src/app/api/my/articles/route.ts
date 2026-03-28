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
    .from("articles")
    .select("id, title, summary, status, view_count, published_at, created_at, tags")
    .eq("author_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ articles: rows ?? [] });
}
