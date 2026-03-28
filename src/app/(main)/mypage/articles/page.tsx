"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  status: string;
  view_count: number;
  published_at: string | null;
  created_at: string;
};

export default function MyArticlesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/my/articles", { credentials: "include" });
      if (res.status === 401) {
        setError("ログインが必要です");
        return;
      }
      if (res.status === 403) {
        setError("公認再生プロのみ利用できます");
        return;
      }
      if (!res.ok) {
        setError("読み込みに失敗しました");
        return;
      }
      const j = (await res.json()) as { articles?: Row[] };
      setRows(j.articles ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">自分のコラム</h1>
        <Link href="/articles/new" className={cn(buttonVariants({ size: "sm" }), "inline-flex")}>
          新規作成
        </Link>
      </div>
      <Link
        href="/mypage"
        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
      >
        ← マイページ
      </Link>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {!error && rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">まだコラムがありません。</p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4"
          >
            <div className="min-w-0">
              <Link href={`/articles/${r.id}`} className="font-medium hover:underline">
                {r.title}
              </Link>
              <p className="text-muted-foreground mt-1 text-xs">
                {r.status === "published" ? "公開" : r.status === "draft" ? "下書き" : r.status} ・ 👁{" "}
                {r.view_count}
                {r.published_at
                  ? ` ・ ${new Date(r.published_at).toLocaleDateString("ja-JP")}`
                  : null}
              </p>
            </div>
            <Link
              href={`/articles/${r.id}/edit`}
              className={cn(
                "text-primary text-sm underline-offset-4 hover:underline shrink-0",
              )}
            >
              編集
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
