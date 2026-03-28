import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleStatus, ProSpecialty } from "@/types/database";

const PRO_SPECIALTIES: ProSpecialty[] = [
  "restructuring",
  "lawyer",
  "accountant",
  "sponsor",
  "fund",
  "other_expert",
];

function isArticleStatus(v: unknown): v is ArticleStatus {
  return v === "draft" || v === "published";
}

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
  const specialty = url.searchParams.get("specialty");
  const tag = url.searchParams.get("tag")?.trim() || "";

  let authorFilter: string[] | null = null;
  if (specialty && PRO_SPECIALTIES.includes(specialty as ProSpecialty)) {
    const { data: pros } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("is_certified_pro", true)
      .eq("pro_specialty", specialty as ProSpecialty);
    authorFilter = (pros ?? []).map((p) => p.user_id);
    if (authorFilter.length === 0) {
      return NextResponse.json({ articles: [], total: 0, page, total_pages: 0 });
    }
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let countQ = supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  let listQ = supabase
    .from("articles")
    .select(
      "id, title, summary, tags, view_count, published_at, author_user_id, created_at",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (authorFilter) {
    countQ = countQ.in("author_user_id", authorFilter);
    listQ = listQ.in("author_user_id", authorFilter);
  }

  if (tag) {
    countQ = countQ.contains("tags", [tag]);
    listQ = listQ.contains("tags", [tag]);
  }

  const [{ count }, { data: rows, error }] = await Promise.all([countQ, listQ]);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const authorIds = [...new Set((rows ?? []).map((r) => r.author_user_id))];
  type AuthorOut = {
    nickname: string;
    avatar_url: string | null;
    pro_specialty: { slug: string; name: string; icon: string | null } | null;
  };
  const profByUser = new Map<string, AuthorOut>();

  if (authorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url, pro_specialty")
      .in("user_id", authorIds);

    const slugs = [
      ...new Set(
        (profs ?? []).map((p) => p.pro_specialty).filter((x): x is ProSpecialty => Boolean(x)),
      ),
    ];
    const specBySlug = new Map<string, { name: string; icon: string | null }>();
    if (slugs.length > 0) {
      const { data: specs } = await supabase
        .from("pro_specialties")
        .select("slug, name, icon")
        .in("slug", slugs);
      for (const s of specs ?? []) specBySlug.set(s.slug, { name: s.name, icon: s.icon });
    }

    for (const p of profs ?? []) {
      const slug = p.pro_specialty;
      const meta = slug ? specBySlug.get(slug) : undefined;
      profByUser.set(p.user_id, {
        nickname: p.nickname,
        avatar_url: p.avatar_url,
        pro_specialty:
          slug && meta
            ? { slug, name: meta.name, icon: meta.icon }
            : slug
              ? { slug, name: slug, icon: null }
              : null,
      });
    }
  }

  const articles = (rows ?? []).map((r) => {
    const prof = profByUser.get(r.author_user_id);
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      tags: r.tags ?? [],
      view_count: r.view_count,
      published_at: r.published_at,
      author: {
        nickname: prof?.nickname ?? "利用者",
        avatar_url: prof?.avatar_url ?? null,
        pro_specialty: prof?.pro_specialty ?? null,
      },
    };
  });

  const total = count ?? 0;
  const total_pages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    articles,
    total,
    page,
    total_pages,
  });
}

export async function POST(request: Request) {
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

  const rl = await checkRateLimit({
    key: `article_post:${user.id}`,
    limit: 5,
    windowSeconds: 86_400,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const bodyMd = typeof o.body === "string" ? o.body.trim() : "";
  const summary =
    typeof o.summary === "string" ? o.summary.trim().slice(0, 200) : null;
  const status = o.status;
  const tagsRaw = Array.isArray(o.tags) ? o.tags : [];

  if (!isArticleStatus(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  if (title.length < 1 || title.length > 100) {
    return NextResponse.json({ error: "invalid_title" }, { status: 400 });
  }

  if (bodyMd.length < 1 || bodyMd.length > 10_000) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const tags: string[] = [];
  for (const t of tagsRaw.slice(0, 5)) {
    if (typeof t !== "string") continue;
    const s = t.trim();
    if (s.length >= 1 && s.length <= 20) tags.push(s);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_certified_pro")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_certified_pro) {
    return NextResponse.json({ error: "forbidden_not_pro" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const published_at = status === "published" ? now : null;

  const { data: row, error } = await supabase
    .from("articles")
    .insert({
      author_user_id: user.id,
      title,
      body: bodyMd,
      summary: summary && summary.length > 0 ? summary : null,
      tags: tags.length > 0 ? tags : null,
      status,
      published_at,
      updated_at: now,
    })
    .select("id, title, status, published_at")
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({
    id: row!.id,
    title: row!.title,
    status: row!.status,
    published_at: row!.published_at,
  });
}
