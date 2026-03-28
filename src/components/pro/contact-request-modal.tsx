"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CertifiedProBadge } from "@/components/ui/certified-pro-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { ProSpecialtyBadge } from "@/lib/pro/pro-specialty-badge";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  targetNickname: string;
  targetAvatarUrl: string | null;
  targetSpecialty: ProSpecialtyBadge | null;
};

export function ContactRequestModal({
  open,
  onClose,
  targetNickname,
  targetAvatarUrl,
  targetSpecialty,
}: Props) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_pro_nickname: targetNickname,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const j = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(j.message ?? "送信に失敗しました");
        return;
      }
      setDone(true);
      setSubject("");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setDone(false);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="bg-foreground/40 absolute inset-0 backdrop-blur-[2px]"
        aria-label="閉じる"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-req-title"
        className="border-border bg-card relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 id="contact-req-title" className="text-lg font-semibold">
            運営を通じて相談する
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            閉じる
          </Button>
        </div>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              相談リクエストを送信しました。
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              運営が確認の上、おつなぎいたします。回答が届いた場合はメールでお知らせします。
            </p>
            <Button type="button" className="w-full" onClick={handleClose}>
              閉じる
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3">
              <UserAvatar avatarUrl={targetAvatarUrl} nickname={targetNickname} size="lg" />
              <div className="min-w-0">
                <p className="font-medium">{targetNickname}</p>
                <CertifiedProBadge specialty={targetSpecialty} size="sm" />
              </div>
            </div>
            <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
              この相談は運営（もりみち事務局）を通じてお伝えします。直接の連絡先交換は行いません。
            </p>
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="cr-subject" className="text-sm font-medium">
                  件名（100文字以内）
                </label>
                <input
                  id="cr-subject"
                  required
                  maxLength={100}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={cn(
                    "border-input bg-background h-10 w-full rounded-md border px-3 text-sm",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  )}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="cr-msg" className="text-sm font-medium">
                  ご相談内容（2000文字以内）
                </label>
                <textarea
                  id="cr-msg"
                  required
                  maxLength={2000}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={cn(
                    "border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 text-sm",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  )}
                />
                <p className="text-muted-foreground text-xs">{message.length} / 2000文字</p>
              </div>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                相談リクエストを送信する
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
