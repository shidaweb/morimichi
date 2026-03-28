import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ProSpecialty } from "@/types/database";

export type ArticleListItem = {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
  view_count: number;
  published_at: string | null;
  author: {
    nickname: string;
    avatar_url: string | null;
    pro_specialty: { slug: string; name: string; icon: string | null } | null;
  };
};

export async function fetchPublishedArticles(
  supabase: SupabaseClient<Database>,
  opts: {
    page: number;
    limit: number;
    specialty?: ProSpecialty | null;
    tag?: string | null;
  },
): Promise<{ articles: ArticleListItem[]; total: number; total_pages: number }> {
  const { page, limit, specialty, tag } = opts;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let authorFilter: string[] | null = null;
  if (specialty) {
    const { data: pros } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("is_certified_pro", true)
      .eq("pro_specialty", specialty);
    authorFilter = (pros ?? []).map((p) => p.user_id);
    if (authorFilter.length === 0) {
      return { articles: [], total: 0, total_pages: 0 };
    }
  }

  let countQ = supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  let listQ = supabase
    .from("articles")
    .select(
      "id, title, summary, tags, view_count, published_at, author_user_id",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (authorFilter) {
    countQ = countQ.in("author_user_id", authorFilter);
    listQ = listQ.in("author_user_id", authorFilter);
  }

  if (tag?.trim()) {
    countQ = countQ.contains("tags", [tag.trim()]);
    listQ = listQ.contains("tags", [tag.trim()]);
  }

  const [{ count }, { data: rows, error }] = await Promise.all([countQ, listQ]);

  if (error) throw error;

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

  const articles: ArticleListItem[] = (rows ?? []).map((r) => {
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

  return { articles, total, total_pages };
}
