"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

type Initial = {
  notificationOnReply: boolean;
  notificationOnReaction: boolean;
  notificationDigest: boolean;
};

type Props = {
  initial: Initial;
};

export function NotificationSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [reply, setReply] = useState(initial.notificationOnReply);
  const [reaction, setReaction] = useState(initial.notificationOnReaction);
  const [digest, setDigest] = useState(initial.notificationDigest);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/profile/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notificationOnReply: reply,
          notificationOnReaction: reaction,
          notificationDigest: digest,
        }),
      });
      if (!res.ok) {
        setError("保存に失敗しました");
        setPending(false);
        return;
      }
      setMessage("保存しました");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    }
    setPending(false);
  }

  return (
    <section className="border-border space-y-4 rounded-xl border p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">通知設定</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          メールアドレス宛に、新しい回答のお知らせを送ります。本文は含めず、サイトへのリンクのみです。
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex cursor-pointer gap-3 text-sm leading-relaxed">
          <Checkbox
            checked={reply}
            onCheckedChange={(c) => setReply(c === true)}
            disabled={pending}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">相談・回答に新しい返信がついたとき</span>
            <span className="text-muted-foreground block text-xs">
              自分の相談に回答がついた場合、または自分の回答に返信がついた場合にメールします。
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer gap-3 text-sm leading-relaxed">
          <Checkbox
            checked={reaction}
            onCheckedChange={(c) => setReaction(c === true)}
            disabled={pending}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">共感がついたとき（今後）</span>
            <span className="text-muted-foreground block text-xs">
              現在はメール送信していません。今後オンにしたとき用の設定です。
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer gap-3 text-sm leading-relaxed">
          <Checkbox
            checked={digest}
            onCheckedChange={(c) => setDigest(c === true)}
            disabled={pending}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">同じスレッドの通知をまとめる（1時間）</span>
            <span className="text-muted-foreground block text-xs">
              オンにすると、同じ相談スレッドからの通知は最大1時間に1通にまとめます。オフのときは都度すぐに送ります。
            </span>
          </span>
        </label>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}

      <Button type="button" disabled={pending} onClick={() => void save()}>
        {pending ? "保存中…" : "保存"}
      </Button>
    </section>
  );
}
