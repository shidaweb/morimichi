"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  requester_nickname: string;
  target_nickname: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export function AdminContactRequestsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contact-requests", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { requests?: Row[] };
      setRows(j.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, action: "forward" | "close" | "reject") {
    setBusy(true);
    try {
      await fetch(`/api/admin/contact-requests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, admin_note: note.trim() || null }),
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
      {loading ? <p className="text-muted-foreground text-sm">読み込み中…</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-border border-b text-left">
              <th className="p-2 font-medium">依頼者</th>
              <th className="p-2 font-medium">宛先</th>
              <th className="p-2 font-medium">件名</th>
              <th className="p-2 font-medium">状態</th>
              <th className="p-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-border border-b">
                <td className="p-2">{r.requester_nickname}</td>
                <td className="p-2">{r.target_nickname}</td>
                <td className="p-2">{r.subject}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setActive(r)}>
                    開く
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="bg-foreground/40 absolute inset-0"
            aria-label="閉じる"
            onClick={() => setActive(null)}
          />
          <div className="border-border bg-card relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{active.subject}</h2>
            <p className="text-muted-foreground mt-2 text-xs">
              {active.requester_nickname} → {active.target_nickname}
            </p>
            <pre className="bg-muted mt-3 max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {active.message}
            </pre>
            <label className="mt-4 block text-sm font-medium">内部メモ</label>
            <textarea
              className={cn(
                "border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {active.status === "pending" ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void patch(active.id, "forward")}
                >
                  プロに転送
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void patch(active.id, "close")}
              >
                クローズ
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
