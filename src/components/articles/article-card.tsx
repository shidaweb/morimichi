import Link from "next/link";
import { Calendar, Eye } from "lucide-react";

import { CertifiedProBadge } from "@/components/ui/certified-pro-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { ArticleListItem } from "@/lib/articles/fetch-articles-public";

type Props = { article: ArticleListItem };

export function ArticleCard({ article }: Props) {
  const published = article.published_at
    ? new Date(article.published_at).toLocaleDateString("ja-JP")
    : "—";

  return (
    <Link
      href={`/articles/${article.id}`}
      className="border-border bg-card hover:border-primary/30 block rounded-xl border p-5 transition-colors"
    >
      <div className="mb-3 flex items-start gap-3">
        <UserAvatar
          avatarUrl={article.author.avatar_url}
          nickname={article.author.nickname}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{article.author.nickname}</span>
            <CertifiedProBadge
              specialty={article.author.pro_specialty}
              size="sm"
              showSpecialty={true}
            />
          </div>
        </div>
      </div>
      <h2 className="mb-2 line-clamp-2 text-lg font-semibold tracking-tight">{article.title}</h2>
      {article.summary ? (
        <p className="text-muted-foreground mb-3 line-clamp-2 text-sm leading-relaxed">
          {article.summary}
        </p>
      ) : null}
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {article.view_count.toLocaleString("ja-JP")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {published}
          </span>
        </div>
        {article.tags.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-1">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
