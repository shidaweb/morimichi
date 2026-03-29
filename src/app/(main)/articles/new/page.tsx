"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArticleContent } from "@/components/articles/article-content";
import { ArticleMarkdownField } from "@/components/articles/article-markdown-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCertifiedPro, setIsCertifiedPro] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/users/me", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { is_certified_pro?: boolean };
      setIsCertifiedPro(Boolean(j.is_certified_pro));
    })();
  }, []);

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
      const res = await fetch("/api/articles", {
        method: "POST",
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
      const j = (await res.json()) as { id?: string; error?: string; message?: string };
      if (!res.ok) {
        setError(j.message ?? "保存に失敗しました");
        return;
      }
      if (j.id) router.push(`/articles/${j.id}`);
      else router.push("/mypage/articles");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/mypage"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          ← マイページに戻る
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">コラムを書く</h1>

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
            <label className="text-sm font-medium">タイトル（100文字以内）</label>
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
            <label className="text-sm font-medium">概要（一覧用・200文字以内）</label>
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
          <ArticleMarkdownField
            id="new-article-body"
            label="本文（マークダウン・1万文字以内）"
            body={body}
            setBody={setBody}
            maxLength={10_000}
            rows={16}
            isCertifiedPro={isCertifiedPro}
          />
          <div className="space-y-2">
            <span className="text-sm font-medium">タグ（最大5つ）</span>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                >
                  {t}
                  <span aria-hidden>✕</span>
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
                  placeholder="タグを入力して Enter"
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
          <h2 className="mb-4 text-xl font-semibold">{title || "（タイトルなし）"}</h2>
          <ArticleContent
            markdown={body || "（本文なし）"}
            className="[&_a]:text-primary text-sm leading-relaxed [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          />
        </div>
      )}

      <p className="text-muted-foreground rounded-lg border border-amber-200/50 bg-amber-50/80 p-3 text-xs leading-relaxed dark:border-amber-900/40 dark:bg-amber-950/30">
        記事の内容は個人的な経験・見解としてお書きください。法的助言や断定的な表現はお控えください。
      </p>

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
