"use client";

import Link from "next/link";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ActivityConsultationItem = {
  id: string;
  title: string;
  excerpt: string;
  created_at: string;
  phase: { name: string; icon: string | null } | null;
};

export type ActivityReplyItem = {
  id: string;
  consultation_id: string;
  excerpt: string;
  created_at: string;
  consultation_title: string;
  phase: { name: string; icon: string | null } | null;
};

type Props = {
  consultations: ActivityConsultationItem[];
  replies: ActivityReplyItem[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    dateStyle: "medium",
  });
}

export function ActivityHistory({ consultations, replies }: Props) {
  const [tab, setTab] = useState("consultations");

  return (
    <section className="border-border space-y-4 rounded-xl border p-6" aria-labelledby="activity-history-heading">
      <h2 id="activity-history-heading" className="text-lg font-semibold tracking-tight">
        最近の活動
      </h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="consultations">自分の相談</TabsTrigger>
          <TabsTrigger value="replies">自分の回答</TabsTrigger>
        </TabsList>
        <TabsContent value="consultations" className="mt-4 space-y-3">
          {consultations.length === 0 ? (
            <p className="text-muted-foreground text-sm">まだ相談の投稿はありません。</p>
          ) : (
            <ul className="space-y-3">
              {consultations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/consultations/${c.id}`}
                    className="border-border hover:border-primary/40 block rounded-lg border bg-card/40 p-3 transition-colors"
                  >
                    <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-2 text-xs">
                      {c.phase ? (
                        <span>
                          <span className="mr-0.5">{c.phase.icon}</span>
                          {c.phase.name}
                        </span>
                      ) : null}
                      <time dateTime={c.created_at}>{formatDate(c.created_at)}</time>
                    </div>
                    <p className="font-medium leading-snug">{c.title}</p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{c.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="replies" className="mt-4 space-y-3">
          {replies.length === 0 ? (
            <p className="text-muted-foreground text-sm">まだ回答の投稿はありません。</p>
          ) : (
            <ul className="space-y-3">
              {replies.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/consultations/${r.consultation_id}`}
                    className="border-border hover:border-primary/40 block rounded-lg border bg-card/40 p-3 transition-colors"
                  >
                    <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-2 text-xs">
                      {r.phase ? (
                        <span>
                          <span className="mr-0.5">{r.phase.icon}</span>
                          {r.phase.name}
                        </span>
                      ) : null}
                      <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
                    </div>
                    <p className="font-medium leading-snug line-clamp-2">{r.consultation_title}</p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{r.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
