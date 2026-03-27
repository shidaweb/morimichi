"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ContentStatus } from "@/types/database";

type Row = {
  id: string;
  title: string;
  status: ContentStatus;
  crisis_flag: boolean | null;
  created_at: string;
  reply_count: number | null;
  view_count: number | null;
};

const STATUS_FILTER: { value: string; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "published", label: "公開" },
  { value: "hidden", label: "非表示" },
  { value: "deleted", label: "削除" },
];

const STATUS_LABEL: Record<ContentStatus, string> = {
  published: "公開",
  hidden: "非表示",
  deleted: "削除",
};

export function AdminConsultationsClient() {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q =
        filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/admin/consultations${q}`);
      const data = (await res.json()) as { items?: Row[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "読み込みに失敗しました");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">投稿管理</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          再読み込み
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTER.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={
              filter === f.value
                ? "bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium"
                : "bg-muted text-muted-foreground hover:bg-muted/80 rounded-full px-3 py-1 text-xs font-medium"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="text-muted-foreground text-sm">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">該当する投稿がありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">日時</th>
                <th className="px-3 py-2 font-medium">タイトル</th>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 font-medium">危機</th>
                <th className="px-3 py-2 font-medium">返信/閲覧</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/consultations/${r.id}`}
                      className="text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{STATUS_LABEL[r.status]}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.crisis_flag ? (
                      <span className="text-destructive font-medium">あり</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {r.reply_count ?? 0} / {r.view_count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
