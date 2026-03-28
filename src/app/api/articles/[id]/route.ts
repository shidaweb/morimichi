import { NextResponse } from "next/server";

import { getAdminContext, getModeratorContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleStatus, ProSpecialty } from "@/types/database";

type Ctx = { params: Promise<{ id: string }> };

function isArticleStatus(v: unknown): v is ArticleStatus {
  return v === "draft" || v === "published" || v === "hidden" || v === "deleted";
}

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row, error } = await supabase
    .from("articles")
    .select(
      "id, author_user_id, title, body, summary, tags, status, view_count, published_at, created_at, updated_at, cover_image_url",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (row.status !== "published" && row.author_user_id !== user?.id) {
    const mod = user ? await getModeratorContext(supabase) : null;
    if (!mod) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("nickname, avatar_url, headline, pro_specialty")
    .eq("user_id", row.author_user_id)
    .maybeSingle();

  let pro_specialty: { slug: string; name: string; icon: string | null } | null = null;
  if (prof?.pro_specialty) {
    const { data: s } = await supabase
      .from("pro_specialties")
      .select("slug, name, icon")
      .eq("slug", prof.pro_specialty as ProSpecialty)
      .maybeSingle();
    if (s) pro_specialty = { slug: s.slug, name: s.name, icon: s.icon };
    else pro_specialty = { slug: prof.pro_specialty, name: prof.pro_specialty, icon: null };
  }

  const { data: moreArticles } = await supabase
    .from("articles")
    .select("id, title, published_at")
    .eq("author_user_id", row.author_user_id)
    .eq("status", "published")
    .neq("id", id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(5);

  return NextResponse.json({
    article: {
      id: row.id,
      title: row.title,
      body: row.body,
      summary: row.summary,
      tags: row.tags ?? [],
      status: row.status,
      view_count: row.view_count,
      published_at: row.published_at,
      cover_image_url: row.cover_image_url,
      created_at: row.created_at,
      author: {
        user_id: row.author_user_id,
        nickname: prof?.nickname ?? "利用者",
        avatar_url: prof?.avatar_url ?? null,
        headline: prof?.headline ?? null,
        pro_specialty,
      },
      more_from_author: moreArticles ?? [],
    },
  });
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;

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

  const { data: existing } = await supabase
    .from("articles")
    .select("author_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = await getAdminContext(supabase);
  const isAuthor = existing.author_user_id === user.id;

  if (!isAuthor && !admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { updated_at: now };

  if (isAuthor) {
    if (typeof o.title === "string") {
      const t = o.title.trim();
      if (t.length < 1 || t.length > 100) {
        return NextResponse.json({ error: "invalid_title" }, { status: 400 });
      }
      patch.title = t;
    }
    if (typeof o.body === "string") {
      const b = o.body.trim();
      if (b.length < 1 || b.length > 10_000) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
      }
      patch.body = b;
    }
    if (o.summary !== undefined) {
      patch.summary =
        typeof o.summary === "string" && o.summary.trim().length > 0
          ? o.summary.trim().slice(0, 200)
          : null;
    }
    if (Array.isArray(o.tags)) {
      const tags: string[] = [];
      for (const t of o.tags.slice(0, 5)) {
        if (typeof t !== "string") continue;
        const s = t.trim();
        if (s.length >= 1 && s.length <= 20) tags.push(s);
      }
      patch.tags = tags.length > 0 ? tags : null;
    }
    if (o.status !== undefined) {
      if (!isArticleStatus(o.status)) {
        return NextResponse.json({ error: "invalid_status" }, { status: 400 });
      }
      patch.status = o.status;
      if (o.status === "published" && existing.status !== "published") {
        patch.published_at = now;
      }
    }
  }

  if (admin && o.status !== undefined && isArticleStatus(o.status)) {
    patch.status = o.status;
  }

  const { error } = await supabase.from("articles").update(patch).eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;

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

  const { data: existing } = await supabase
    .from("articles")
    .select("author_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = await getAdminContext(supabase);
  if (existing.author_user_id !== user.id && !admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("articles").delete().eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
