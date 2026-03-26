"use client";

import { useState } from "react";

import { PersonalOpinionCheck } from "@/components/thread/PersonalOpinionCheck";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  consultationId: string;
  parentReplyId?: string | null;
  isTopLevel: boolean;
  isLoggedIn: boolean;
  disabled?: boolean;
  onSuccess: () => void | Promise<void>;
};

export function ReplyForm({
  consultationId,
  parentReplyId = null,
  isTopLevel,
  isLoggedIn,
  disabled,
  onSuccess,
}: Props) {
  const [body, setBody] = useState("");
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn || pending || disabled) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/consultations/${consultationId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body,
          parentReplyId: parentReplyId || undefined,
          personalOpinionAck: isTopLevel ? ack : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        details?: { fieldErrors?: Record<string, string[]> };
      };
      if (!res.ok) {
        if (j.error === "rate_limited") {
          setError("本日の投稿上限に達しました。明日またお試しください。");
        } else if (
          j.error === "validation" &&
          j.details?.fieldErrors?.personalOpinionAck?.[0]
        ) {
          setError(j.details.fieldErrors.personalOpinionAck[0]);
        } else if (j.error === "validation" && j.details?.fieldErrors?.body?.[0]) {
          setError(j.details.fieldErrors.body[0]);
        } else if (j.error === "forbidden" && j.message) {
          setError(j.message);
        } else {
          setError("投稿に失敗しました");
        }
        setPending(false);
        return;
      }
      setBody("");
      setAck(false);
      await onSuccess();
    } catch {
      setError("通信エラーが発生しました");
    }
    setPending(false);
  }

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-sm">
        返信するには{" "}
        <a href="/login" className="text-primary underline-offset-4 hover:underline">
          ログイン
        </a>{" "}
        が必要です。
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      {isTopLevel ? (
        <PersonalOpinionCheck checked={ack} onCheckedChange={setAck} disabled={pending} />
      ) : null}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={10000}
        placeholder={isTopLevel ? "経験や気づきを丁寧に書いてください" : "返信を入力してください"}
        disabled={pending || disabled}
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending || disabled || (isTopLevel && !ack)}>
        {isTopLevel ? "回答する" : "返信する"}
      </Button>
    </form>
  );
}
