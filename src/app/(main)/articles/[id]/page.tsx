import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Eye } from "lucide-react";

import { ArticleContent } from "@/components/articles/article-content";
import { ArticleDetailActions } from "@/components/articles/article-detail-actions";
import { ArticleViewTracker } from "@/components/articles/article-view-tracker";
import { CertifiedProBadge } from "@/components/ui/certified-pro-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getArticleForPublicPage } from "@/lib/articles/get-article-public-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function ArticleDetailPage({ params }: Props) {
  const { id } = await params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const article = await getArticleForPublicPage(supabase, id);
  if (!article) notFound();

  const showContact = Boolean(user && user.id !== article.author.user_id);

  const published = article.published_at
    ? new Date(article.published_at).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ArticleViewTracker articleId={article.id} />

      <Link
        href="/articles"
        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
      >
        ← コラム一覧に戻る
      </Link>

      <article className="space-y-6">
        <header className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{article.title}</h1>
          <div className="flex flex-wrap items-start gap-4">
            <UserAvatar
              avatarUrl={article.author.avatar_url}
              nickname={article.author.nickname}
              size="xl"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium">{article.author.nickname}</p>
              {article.author.pro_specialty ? (
                <CertifiedProBadge specialty={article.author.pro_specialty} size="md" />
              ) : null}
              {article.author.headline ? (
                <p className="text-muted-foreground text-sm">{article.author.headline}</p>
              ) : null}
              <p className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  {published} 公開
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  {article.view_count.toLocaleString("ja-JP")}
                </span>
              </p>
            </div>
          </div>
        </header>

        <div className="border-border border-t pt-6">
          <ArticleContent
            markdown={article.body}
            className="[&_a]:text-primary text-sm leading-relaxed [&_blockquote]:text-muted-foreground [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:bg-muted [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5"
          />
        </div>

        <p className="text-muted-foreground border-border rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
          本記事は個人的な経験・見解に基づく情報です。法的助言や断定的な判断の代わりにはなりません。
        </p>

        {article.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {article.tags.map((t) => (
              <span key={t} className="bg-muted rounded-full px-2 py-1 text-xs">
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        {article.more_from_author.length > 0 ? (
          <section className="border-border space-y-3 border-t pt-6">
            <h2 className="text-sm font-semibold">この著者の他の記事</h2>
            <ul className="space-y-2 text-sm">
              {article.more_from_author.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/articles/${a.id}`}
                    className="text-primary hover:underline"
                  >
                    {a.title}
                  </Link>
                  {a.published_at ? (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {new Date(a.published_at).toLocaleDateString("ja-JP")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-border space-y-3 rounded-xl border bg-card/40 p-5">
          <h2 className="text-sm font-semibold">著者に相談する</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            この公認再生プロに、運営を通じて相談することができます。
          </p>
          {!user ? (
            <p className="text-muted-foreground text-sm">
              <Link href={`/login?next=/articles/${article.id}`} className="text-primary underline">
                ログイン
              </Link>
              してご利用ください。
            </p>
          ) : !showContact ? (
            <p className="text-muted-foreground text-sm">これはあなたの記事です。</p>
          ) : (
            <ArticleDetailActions
              targetNickname={article.author.nickname}
              targetAvatarUrl={article.author.avatar_url}
              targetSpecialty={article.author.pro_specialty}
              showContact
            />
          )}
        </section>
      </article>
    </div>
  );
}
