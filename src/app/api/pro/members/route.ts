import { NextResponse } from "next/server";

import { fetchProfileStats } from "@/lib/profile/public-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProSpecialty } from "@/types/database";

const SPECIALTIES: ProSpecialty[] = [
  "restructuring",
  "lawyer",
  "accountant",
  "sponsor",
  "fund",
  "other_expert",
];

export async function GET(request: Request) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const specialtyParam = url.searchParams.get("specialty");
  const keyword = url.searchParams.get("keyword")?.trim() ?? "";
  const phase = url.searchParams.get("phase")?.trim() ?? "";
  const sort = url.searchParams.get("sort") ?? "replies";

  let q = supabase
    .from("profiles")
    .select(
      "user_id, nickname, avatar_url, headline, bio, prefecture, years_of_experience, experience_phases, pro_specialty, pro_certified_at, created_at",
    )
    .eq("is_certified_pro", true);

  if (specialtyParam && SPECIALTIES.includes(specialtyParam as ProSpecialty)) {
    q = q.eq("pro_specialty", specialtyParam as ProSpecialty);
  }

  if (keyword) {
    const safe = keyword.replace(/%/g, "").slice(0, 50);
    if (safe.length > 0) {
      q = q.or(`nickname.ilike.%${safe}%,bio.ilike.%${safe}%`);
    }
  }

  if (phase) {
    q = q.contains("experience_phases", [phase]);
  }

  const { data: rows, error } = await q.limit(400);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const specSlugs = [
    ...new Set(
      (rows ?? []).map((r) => r.pro_specialty).filter((x): x is ProSpecialty => Boolean(x)),
    ),
  ];
  const specBySlug = new Map<string, { name: string; icon: string | null }>();
  if (specSlugs.length > 0) {
    const { data: specs } = await supabase
      .from("pro_specialties")
      .select("slug, name, icon")
      .in("slug", specSlugs);
    for (const s of specs ?? []) specBySlug.set(s.slug, { name: s.name, icon: s.icon });
  }

  const phaseSlugSet = new Set<string>();
  for (const r of rows ?? []) {
    for (const ph of r.experience_phases ?? []) phaseSlugSet.add(ph);
  }
  const phaseLabel = new Map<string, string>();
  if (phaseSlugSet.size > 0) {
    const { data: phRows } = await supabase
      .from("phases")
      .select("slug, name, icon")
      .in("slug", [...phaseSlugSet]);
    for (const p of phRows ?? []) {
      phaseLabel.set(p.slug, p.icon ? `${p.icon}${p.name}` : p.name);
    }
  }

  type Member = {
    nickname: string;
    avatar_url: string | null;
    headline: string | null;
    bio: string | null;
    prefecture: string | null;
    years_of_experience: number | null;
    pro_specialty: { slug: string; name: string; icon: string | null };
    experience_phases: string[];
    stats: {
      total_replies: number;
      total_reactions_received: number;
      total_articles: number;
      total_article_views: number;
    };
    pro_certified_at: string | null;
  };

  const enriched: Member[] = [];

  for (const r of rows ?? []) {
    if (!r.pro_specialty) continue;
    const sm = specBySlug.get(r.pro_specialty);
    const pro_specialty = sm
      ? { slug: r.pro_specialty, name: sm.name, icon: sm.icon }
      : { slug: r.pro_specialty, name: r.pro_specialty, icon: null };

    const statsBase = await fetchProfileStats(supabase, r.user_id, r.created_at);

    const { data: arts } = await supabase
      .from("articles")
      .select("view_count")
      .eq("author_user_id", r.user_id)
      .eq("status", "published");

    const total_articles = arts?.length ?? 0;
    const total_article_views = (arts ?? []).reduce((acc, a) => acc + (a.view_count ?? 0), 0);

    const experience_phases = (r.experience_phases ?? []).map(
      (slug) => phaseLabel.get(slug) ?? slug,
    );

    enriched.push({
      nickname: r.nickname,
      avatar_url: r.avatar_url,
      headline: r.headline,
      bio: r.bio,
      prefecture: r.prefecture,
      years_of_experience: r.years_of_experience,
      pro_specialty,
      experience_phases,
      stats: {
        total_replies: statsBase.total_replies,
        total_reactions_received: statsBase.total_reactions_received,
        total_articles,
        total_article_views,
      },
      pro_certified_at: r.pro_certified_at,
    });
  }

  if (sort === "reactions") {
    enriched.sort((a, b) => b.stats.total_reactions_received - a.stats.total_reactions_received);
  } else if (sort === "newest") {
    enriched.sort((a, b) => {
      const ta = a.pro_certified_at ? new Date(a.pro_certified_at).getTime() : 0;
      const tb = b.pro_certified_at ? new Date(b.pro_certified_at).getTime() : 0;
      return tb - ta;
    });
  } else {
    enriched.sort((a, b) => b.stats.total_replies - a.stats.total_replies);
  }

  const total = enriched.length;
  const start = (page - 1) * limit;
  const slice = enriched.slice(start, start + limit);
  const total_pages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    members: slice,
    total,
    page,
    total_pages,
  });
}
