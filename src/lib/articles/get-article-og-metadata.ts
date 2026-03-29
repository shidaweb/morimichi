import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type ArticleOgMetadata = {
  title: string;
  summary: string | null;
  body: string;
  cover_image_url: string | null;
  published_at: string | null;
  authorNickname: string;
};

/** generateMetadata 用の軽量取得（本文全文は返すが関連記事などは取らない） */
export async function getArticleOgMetadata(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ArticleOgMetadata | null> {
  const { data: row, error } = await supabase
    .from("articles")
    .select("title, summary, body, cover_image_url, published_at, author_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !row || row.status !== "published") {
    return null;
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", row.author_user_id)
    .maybeSingle();

  return {
    title: row.title,
    summary: row.summary,
    body: row.body,
    cover_image_url: row.cover_image_url,
    published_at: row.published_at,
    authorNickname: prof?.nickname ?? "もりみち",
  };
}
