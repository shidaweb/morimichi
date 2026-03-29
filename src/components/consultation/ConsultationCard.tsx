import Link from "next/link";

import { ConsultationAuthorRow } from "@/components/consultation/ConsultationAuthorRow";
import { ViewCounter } from "@/components/consultation/ViewCounter";
import { Badge } from "@/components/ui/badge";
import type { ConsultationListItem } from "@/types/consultations";
import { normalizeConsultationBodyForDisplay } from "@/lib/utils/consultation-body-display";

function excerpt(text: string, max = 120) {
  const t = normalizeConsultationBodyForDisplay(text).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type Props = {
  item: ConsultationListItem;
};

export function ConsultationCard({ item }: Props) {
  const phase = item.phase;
  return (
    <article className="border-border hover:border-primary/30 group rounded-xl border bg-card/60 p-4 transition-colors">
      {item.author ? (
        <div className="mb-3">
          <ConsultationAuthorRow author={item.author} size="md" />
        </div>
      ) : null}
      <Link href={`/consultations/${item.id}`} prefetch={true} className="block space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {phase ? (
            <Badge variant="secondary" className="font-normal">
              <span className="mr-1">{phase.icon}</span>
              {phase.name}
            </Badge>
          ) : null}
          {item.crisis_flag ? (
            <Badge variant="outline" className="border-accent/50 text-accent">
              要配慮
            </Badge>
          ) : null}
        </div>
        <h2 className="group-hover:text-primary text-base font-semibold leading-snug transition-colors">
          {item.title}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {excerpt(item.body)}
        </p>
        <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
          <ViewCounter count={item.view_count ?? 0} className="inline" />
          <span title="回答数" suppressHydrationWarning>
            💬 {(item.reply_count ?? 0).toLocaleString("ja-JP")}回答
          </span>
          <span title="共感" suppressHydrationWarning>
            ❤ {(item.reaction_count ?? 0).toLocaleString("ja-JP")}共感
          </span>
        </div>
      </Link>
    </article>
  );
}
