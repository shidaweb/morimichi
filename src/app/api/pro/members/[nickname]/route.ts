import { NextResponse } from "next/server";

import { fetchProfileStats } from "@/lib/profile/public-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProSpecialty } from "@/types/database";

type Ctx = { params: Promise<{ nickname: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { nickname } = await context.params;
  const decoded = decodeURIComponent(nickname).trim();

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { data: r, error } = await supabase
    .from("profiles")
    .select(
      "user_id, nickname, avatar_url, headline, bio, prefecture, years_of_experience, experience_phases, pro_specialty, pro_certified_at, created_at, is_certified_pro",
    )
    .eq("nickname", decoded)
    .maybeSingle();

  if (error || !r || !r.is_certified_pro || !r.pro_specialty) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: sm } = await supabase
    .from("pro_specialties")
    .select("slug, name, icon")
    .eq("slug", r.pro_specialty as ProSpecialty)
    .maybeSingle();

  const pro_specialty = sm
    ? { slug: sm.slug, name: sm.name, icon: sm.icon }
    : { slug: r.pro_specialty, name: r.pro_specialty, icon: null };

  const statsBase = await fetchProfileStats(supabase, r.user_id, r.created_at);

  const { data: arts } = await supabase
    .from("articles")
    .select("view_count")
    .eq("author_user_id", r.user_id)
    .eq("status", "published");

  const total_articles = arts?.length ?? 0;
  const total_article_views = (arts ?? []).reduce((acc, a) => acc + (a.view_count ?? 0), 0);

  const phaseSlugSet = new Set(r.experience_phases ?? []);
  const phaseLabel: string[] = [];
  if (phaseSlugSet.size > 0) {
    const { data: phRows } = await supabase
      .from("phases")
      .select("slug, name, icon")
      .in("slug", [...phaseSlugSet]);
    for (const p of phRows ?? []) {
      phaseLabel.push(p.icon ? `${p.icon}${p.name}` : p.name);
    }
  }

  return NextResponse.json({
    member: {
      nickname: r.nickname,
      avatar_url: r.avatar_url,
      headline: r.headline,
      bio: r.bio,
      prefecture: r.prefecture,
      years_of_experience: r.years_of_experience,
      pro_specialty,
      experience_phases: phaseLabel,
      stats: {
        total_replies: statsBase.total_replies,
        total_reactions_received: statsBase.total_reactions_received,
        total_articles,
        total_article_views,
      },
      pro_certified_at: r.pro_certified_at,
    },
  });
}
