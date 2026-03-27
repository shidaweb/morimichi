"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialNickname: string;
};

export function NicknameForm({ initialNickname }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialNickname);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/profile/nickname", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nickname: value }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        if (res.status === 409) {
          setError(data?.message ?? "このニックネームはすでに使われています");
        } else if (res.status === 400) {
          setError(data?.message ?? "ニックネームの形式が正しくありません");
        } else {
          setError("保存に失敗しました");
        }
        setPending(false);
        return;
      }
      setMessage("保存しました");
      setValue((v) => v.trim());
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    }
    setPending(false);
  }

  return (
    <section className="border-border space-y-4 rounded-xl border p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">ニックネーム</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          相談や返信に表示される名前です（2〜20文字）。メールアドレスは公開されません。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mypage-nickname">表示名</Label>
        <Input
          id="mypage-nickname"
          autoComplete="nickname"
          maxLength={20}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
        />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}

      <Button type="button" disabled={pending} onClick={() => void save()}>
        {pending ? "保存中…" : "保存"}
      </Button>
    </section>
  );
}
