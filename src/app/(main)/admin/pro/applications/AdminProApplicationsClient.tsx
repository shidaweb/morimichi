"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  user_id: string;
  nickname: string;
  specialty: string;
  application_text: string;
  status: string;
  created_at: string;
  reviewer_note: string | null;
};

export function AdminProApplicationsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [active, setActive] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/admin/pro/applications${q}`, { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { applications?: Row[] };
      setRows(j.applications ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, action: "approve" | "reject") {
    setBusy(true);
    try {
      await fetch(`/api/admin/pro/applications/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewer_note: note.trim() || null }),
      });
      setActive(null);
      setNote("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", ""] as const).map((f) => (
          <Button
            key={f || "all"}
            size="sm"
            variant={filter === f ? "secondary" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "" ? "すべて" : f}
          </Button>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground text-sm">読み込み中…</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-border border-b text-left">
              <th className="p-2 font-medium">ニックネーム</th>
              <th className="p-2 font-medium">専門</th>
              <th className="p-2 font-medium">状態</th>
              <th className="p-2 font-medium">申請日</th>
              <th className="p-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-border border-b">
                <td className="p-2">{r.nickname}</td>
                <td className="p-2">{r.specialty}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("ja-JP")}
                </td>
                <td className="p-2">
                  {r.status === "pending" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setActive(r)}>
                      審査
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="bg-foreground/40 absolute inset-0"
            aria-label="閉じる"
            onClick={() => setActive(null)}
          />
          <div className="border-border bg-card relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border p-5 shadow-xl">
            <h2 className="text-lg font-semibold">申請内容</h2>
            <p className="text-muted-foreground mt-2 text-xs">{active.nickname}</p>
            <pre className="bg-muted mt-3 max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {active.application_text}
            </pre>
            <label className="mt-4 block text-sm font-medium">内部メモ（任意）</label>
            <textarea
              className={cn(
                "border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void patch(active.id, "approve")}
              >
                承認
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void patch(active.id, "reject")}
              >
                却下
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setActive(null)}>
                閉じる
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
