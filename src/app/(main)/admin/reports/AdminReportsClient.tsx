"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Database, ReportReason, ReportStatus } from "@/types/database";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

type ReportItem = ReportRow & { targetLabel: string };

const REASON_LABEL: Record<ReportReason, string> = {
  defamation: "誹謗中傷",
  solicitation: "勧誘",
  crisis: "危機的内容",
  personal_info: "個人情報",
  illegal: "違法行為",
  misinformation: "誤情報",
  legal_advice: "法律相談のように受け取れる表現",
  advisor_solicitation: "アドバイザー勧誘",
  spam: "スパム",
  other: "その他",
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "未対応",
  reviewing: "確認中",
  resolved: "対応済",
  dismissed: "却下",
};

export function AdminReportsClient() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports");
      const data = (await res.json()) as {
        reports?: ReportItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "読み込みに失敗しました");
        return;
      }
      setItems(data.reports ?? []);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: string, status: ReportStatus) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError("ステータス更新に失敗しました");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function moderate(
    report: ReportItem,
    action: "hide" | "delete",
  ) {
    const ok =
      action === "delete"
        ? window.confirm(
            "対象を削除状態にします。よろしいですか？（取り消しは別途対応が必要です）",
          )
        : window.confirm("対象を非表示にしますか？");
    if (!ok) return;

    setBusyId(report.id);
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: report.target_type,
          targetId: report.target_id,
          action,
          reportId: report.id,
        }),
      });
      if (!res.ok) {
        setError("モデレーションの適用に失敗しました");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading && items.length === 0) {
    return <p className="text-muted-foreground text-sm">読み込み中…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">通報一覧</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          再読み込み
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">通報はありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">日時</th>
                <th className="px-3 py-2 font-medium">対象</th>
                <th className="px-3 py-2 font-medium">内容</th>
                <th className="px-3 py-2 font-medium">理由</th>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="text-muted-foreground text-xs">
                      {r.target_type === "consultation" ? "相談" : "返信"}
                    </span>
                    <div className="mt-1 max-w-[220px] break-words">
                      {r.target_type === "consultation" ? (
                        <Link
                          href={`/consultations/${r.target_id}`}
                          className="text-primary hover:underline"
                        >
                          {r.targetLabel}
                        </Link>
                      ) : (
                        <span>{r.targetLabel}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {r.detail ? (
                      <span className="line-clamp-3">{r.detail}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {REASON_LABEL[r.reason]}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                      value={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => {
                        void patchStatus(r.id, e.target.value as ReportStatus);
                      }}
                    >
                      {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={busyId === r.id}
                        onClick={() => void moderate(r, "hide")}
                      >
                        非表示
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="text-xs"
                        disabled={busyId === r.id}
                        onClick={() => void moderate(r, "delete")}
                      >
                        削除
                      </Button>
                    </div>
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
