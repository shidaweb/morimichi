import Link from "next/link";

import { ArticleCard } from "@/components/articles/article-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { fetchPublishedArticles } from "@/lib/articles/fetch-articles-public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ProSpecialty } from "@/types/database";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ page?: string; specialty?: string; tag?: string }>;
};

export default async function ArticlesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const tag = sp.tag?.trim() || null;
  const specialtyRaw = sp.specialty?.trim() || "";
  const specialty =
    specialtyRaw &&
    [
      "restructuring",
      "lawyer",
      "accountant",
      "sponsor",
      "fund",
      "other_expert",
    ].includes(specialtyRaw)
      ? (specialtyRaw as ProSpecialty)
      : null;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">プロのコラム</h1>
        <p className="text-muted-foreground text-sm">読み込みに失敗しました。</p>
      </div>
    );
  }

  const { data: specs } = await supabase
    .from("pro_specialties")
    .select("slug, name, icon")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  let articlesPayload;
  try {
    articlesPayload = await fetchPublishedArticles(supabase, {
      page,
      limit: 20,
      specialty,
      tag,
    });
  } catch {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">プロのコラム</h1>
        <p className="text-muted-foreground text-sm">記事の取得に失敗しました。</p>
      </div>
    );
  }

  const { articles, total_pages } = articlesPayload;

  const q = new URLSearchParams();
  if (specialty) q.set("specialty", specialty);
  if (tag) q.set("tag", tag);

  function pageHref(p: number) {
    const nq = new URLSearchParams(q);
    if (p > 1) nq.set("page", String(p));
    const s = nq.toString();
    return s ? `/articles?${s}` : "/articles";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">公認再生プロのコラム</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          事業再生の専門家が経験をもとに執筆した記事です。内容は個人的な見解であり、法的助言ではありません。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-muted-foreground text-xs font-medium">専門分野</span>
        <div className="flex flex-wrap gap-2">
          <Link
            href={tag ? `/articles?tag=${encodeURIComponent(tag)}` : "/articles"}
            className={cn(
              buttonVariants({ variant: specialty ? "outline" : "secondary", size: "sm" }),
              "inline-flex",
            )}
          >
            すべて
          </Link>
          {(specs ?? []).map((s) => {
            const nq = new URLSearchParams(q);
            nq.set("specialty", s.slug);
            nq.delete("page");
            const href = `/articles?${nq.toString()}`;
            const active = specialty === s.slug;
            return (
              <Link
                key={s.slug}
                href={href}
                className={cn(
                  buttonVariants({ variant: active ? "secondary" : "outline", size: "sm" }),
                  "inline-flex",
                )}
              >
                {s.icon ? `${s.icon} ` : ""}
                {s.name}
              </Link>
            );
          })}
        </div>
      </div>

      {articles.length === 0 ? (
        <p className="text-muted-foreground text-sm">該当する記事がありません。</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {articles.map((a) => (
            <li key={a.id}>
              <ArticleCard article={a} />
            </li>
          ))}
        </ul>
      )}

      {total_pages > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="ページ送り">
          {Array.from({ length: total_pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              className={cn(
                buttonVariants({ variant: p === page ? "default" : "outline", size: "sm" }),
                "inline-flex min-w-[2.25rem] justify-center",
              )}
            >
              {p}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
