import { NextResponse } from "next/server";

import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { updateProfileMe } from "@/lib/profile/update-profile-me";
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

  let { data: profile } = await supabase
    .from("profiles")
    .select("nickname, avatar_url, is_certified_pro, pro_specialty")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr === null) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select("nickname, avatar_url, is_certified_pro, pro_specialty")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = p2;
    }
  }

  const isCertified = Boolean(profile?.is_certified_pro);
  let pro_specialty: { slug: string; name: string; icon: string | null } | null = null;
  if (isCertified && profile?.pro_specialty) {
    const { data: s } = await supabase
      .from("pro_specialties")
      .select("slug, name, icon")
      .eq("slug", profile.pro_specialty)
      .maybeSingle();
    pro_specialty = s
      ? { slug: s.slug, name: s.name, icon: s.icon }
      : { slug: profile.pro_specialty, name: profile.pro_specialty, icon: null };
  }

  return NextResponse.json({
    nickname: profile?.nickname ?? "",
    avatar_url: profile?.avatar_url ?? null,
    is_certified_pro: isCertified,
    pro_specialty,
  });
}

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

  const result = await updateProfileMe(supabase, user, json);
  if (!result.ok) {
    const status = result.field === "nickname" && result.message.includes("すでに") ? 409 : 400;
    return NextResponse.json(
      { error: "update_failed", message: result.message, field: result.field },
      { status },
    );
  }

  return NextResponse.json({ ok: true });
}
