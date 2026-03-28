import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("pro_specialties")
    .select("slug, name, icon, description, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ specialties: data ?? [] });
}
