"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReactionTarget, ReportReason } from "@/types/database";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "defamation", label: "誹謗中傷" },
  { value: "solicitation", label: "勧誘・営業" },
  { value: "crisis", label: "危機的な内容" },
  { value: "personal_info", label: "個人情報の晒し" },
  { value: "illegal", label: "違法行為の助長" },
  { value: "misinformation", label: "虚偽・誤解を招く情報" },
  { value: "legal_advice", label: "無資格の法的助言のように読める" },
  { value: "advisor_solicitation", label: "士業等への不当な誘導" },
  { value: "spam", label: "スパム" },
  { value: "other", label: "その他" },
];

type Props = {
  targetType: ReactionTarget;
  targetId: string;
  isLoggedIn: boolean;
};

export function ReportButton({ targetType, targetId, isLoggedIn }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("other");
  const [detail, setDetail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          detail: detail.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "送信に失敗しました");
        setPending(false);
        return;
      }
      setOpen(false);
      setDetail("");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    }
    setPending(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        disabled={!isLoggedIn}
        onClick={() => setOpen(true)}
      >
        通報
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>通報する</DialogTitle>
            <DialogDescription>
              内容を確認のうえ、必要に応じて対応します。虚偽の通報はお控えください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="report-reason">理由</Label>
              <select
                id="report-reason"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-detail">補足（任意）</Label>
              <Textarea
                id="report-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="運営が判断しやすいよう、簡潔に書いてください"
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="button" disabled={pending} onClick={() => void submit()}>
              {pending ? "送信中…" : "送信"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
