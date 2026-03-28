"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialNickname: string;
  startWithEmptyInput: boolean;
};

/**
 * Cloudflare Workers 上の OpenNext では Server Action の form が不安定なことがあるため、
 * 確実に動く Route Handler（PATCH /api/profile/nickname）で保存する。
 */
export function NicknameEditor({ initialNickname, startWithEmptyInput }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(() =>
    startWithEmptyInput ? "" : initialNickname,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "保存に失敗しました",
        );
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
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="mypage-nickname">ニックネーム</Label>
        <Input
          id="mypage-nickname"
          name="nickname"
          autoComplete="nickname"
          maxLength={20}
          placeholder={startWithEmptyInput ? "例: ツバメタロウ" : undefined}
          value={value}
          onChange={(ev) => setValue(ev.target.value)}
          disabled={pending}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "保存中…" : "保存"}
      </Button>
    </form>
  );
}
