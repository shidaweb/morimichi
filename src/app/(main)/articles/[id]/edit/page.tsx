"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArticleContent } from "@/components/articles/article-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EditArticlePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const res = await fetch(`/api/articles/${id}`, { credentials: "include" });
      if (!res.ok) {
        setError("記事を読み込めませんでした");
        setLoading(false);
        return;
      }
      const j = (await res.json()) as {
        article?: {
          title: string;
          summary: string | null;
          body: string;
          tags: string[];
        };
      };
      const a = j.article;
      if (!a) {
        setError("記事が見つかりません");
        setLoading(false);
        return;
      }
      setTitle(a.title);
      setSummary(a.summary ?? "");
      setBody(a.body);
      setTags(a.tags ?? []);
      setLoading(false);
    })();
  }, [id]);

  function addTag() {
    const t = tagInput.trim();
    if (t.length < 1 || t.length > 20) return;
    if (tags.length >= 5) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  }

  async function save(status: "draft" | "published") {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          body: body.trim(),
          tags,
          status,
        }),
      });
      if (!res.ok) {
        setError("保存に失敗しました");
        return;
      }
      router.push(`/articles/${id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground mx-auto max-w-3xl text-sm">読み込み中…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/articles/${id}`}
        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
      >
        ← 記事に戻る
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">コラムを編集</h1>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "edit" ? "secondary" : "outline"}
          onClick={() => setTab("edit")}
        >
          編集
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "preview" ? "secondary" : "outline"}
          onClick={() => setTab("preview")}
        >
          プレビュー
        </Button>
      </div>

      {tab === "edit" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">タイトル</label>
            <input
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                "border-input bg-background h-10 w-full rounded-md border px-3 text-sm",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">概要</label>
            <textarea
              maxLength={200}
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={cn(
                "border-input bg-background w-full rounded-md border px-3 py-2 text-sm",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">本文</label>
            <textarea
              maxLength={10_000}
              rows={16}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={cn(
                "border-input bg-background font-mono text-sm leading-relaxed",
                "min-h-[280px] w-full rounded-md border px-3 py-2",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">タグ</span>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                >
                  {t} <span aria-hidden>✕</span>
                </button>
              ))}
            </div>
            {tags.length < 5 ? (
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  maxLength={20}
                  className={cn(
                    "border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  )}
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  追加
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="border-border rounded-lg border p-4">
          <h2 className="mb-4 text-xl font-semibold">{title}</h2>
          <ArticleContent
            markdown={body}
            className="[&_a]:text-primary text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
          />
        </div>
      )}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={submitting} onClick={() => void save("draft")}>
          下書き保存
        </Button>
        <Button type="button" disabled={submitting} onClick={() => void save("published")}>
          公開する
        </Button>
      </div>
    </div>
  );
}
