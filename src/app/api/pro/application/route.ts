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
    .select("is_certified_pro, pro_specialty, pro_certified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: apps } = await supabase
    .from("pro_applications")
    .select("id, specialty, application_text, status, created_at, reviewed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const pendingOrApproved =
    apps?.find((a) => a.status === "pending" || a.status === "approved") ?? null;

  let specialtyMeta: { slug: string; name: string; icon: string | null } | null = null;
  const slug = profile?.pro_specialty ?? pendingOrApproved?.specialty;
  if (slug) {
    const { data: s } = await supabase
      .from("pro_specialties")
      .select("slug, name, icon")
      .eq("slug", slug)
      .maybeSingle();
    if (s) specialtyMeta = s;
  }

  return NextResponse.json({
    is_certified_pro: profile?.is_certified_pro ?? false,
    pro_certified_at: profile?.pro_certified_at ?? null,
    pro_specialty: specialtyMeta,
    application: pendingOrApproved,
  });
}

export async function DELETE() {
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

  const { error } = await supabase
    .from("pro_applications")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
