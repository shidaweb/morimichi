import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ProSpecialty } from "@/types/database";

export type ArticlePublicPageData = {
  id: string;
  title: string;
  body: string;
  summary: string | null;
  tags: string[];
  view_count: number;
  published_at: string | null;
  author: {
    user_id: string;
    nickname: string;
    avatar_url: string | null;
    headline: string | null;
    pro_specialty: { slug: string; name: string; icon: string | null } | null;
  };
  more_from_author: { id: string; title: string; published_at: string | null }[];
};

export async function getArticleForPublicPage(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ArticlePublicPageData | null> {
  const { data: row, error } = await supabase
    .from("articles")
    .select(
      "id, author_user_id, title, body, summary, tags, status, view_count, published_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row || row.status !== "published") {
    return null;
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("nickname, avatar_url, headline, pro_specialty, is_certified_pro")
    .eq("user_id", row.author_user_id)
    .maybeSingle();

  let pro_specialty: ArticlePublicPageData["author"]["pro_specialty"] = null;
  if (prof?.is_certified_pro && prof.pro_specialty) {
    const { data: s } = await supabase
      .from("pro_specialties")
      .select("slug, name, icon")
      .eq("slug", prof.pro_specialty as ProSpecialty)
      .maybeSingle();
    pro_specialty = s
      ? { slug: s.slug, name: s.name, icon: s.icon }
      : { slug: prof.pro_specialty, name: prof.pro_specialty, icon: null };
  }

  const { data: more } = await supabase
    .from("articles")
    .select("id, title, published_at")
    .eq("author_user_id", row.author_user_id)
    .eq("status", "published")
    .neq("id", id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(5);

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    summary: row.summary,
    tags: row.tags ?? [],
    view_count: row.view_count,
    published_at: row.published_at,
    author: {
      user_id: row.author_user_id,
      nickname: prof?.nickname ?? "利用者",
      avatar_url: prof?.avatar_url ?? null,
      headline: prof?.headline ?? null,
      pro_specialty,
    },
    more_from_author: more ?? [],
  };
}
