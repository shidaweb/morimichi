"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ExclusiveAccountRole, SwitchableUserRole } from "@/lib/profile/update-profile-role";

type Props = {
  currentRole: ExclusiveAccountRole;
};

/**
 * consulter / advisor のみ表示。both・モデレーター等ではマイページに出さない。
 * Cloudflare Workers 上の OpenNext でも確実に動くよう Route Handler で保存する。
 */
export function AccountRoleSwitcher({ currentRole }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<SwitchableUserRole | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(next: SwitchableUserRole) {
    setPending(next);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/profile/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(
          typeof data.message === "string" ? data.message : "変更に失敗しました",
        );
        setPending(null);
        return;
      }
      setMessage("アカウントの種類を更新しました");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    }
    setPending(null);
  }

  const busy = pending !== null;

  return (
    <section
      className="border-border space-y-4 rounded-xl border p-6"
      aria-labelledby="mypage-account-role-heading"
    >
      <div>
        <h2 id="mypage-account-role-heading" className="text-lg font-semibold tracking-tight">
          アカウントの種類を変更する
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          登録時に選んだ「相談」「回答」「両方」のうち、いまの利用の仕方に合わせて切り替えられます。変更後すぐに相談の投稿や返信の可否が切り替わります。
        </p>
      </div>

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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {currentRole === "consulter" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void changeRole("advisor")}
            >
              {pending === "advisor" ? "変更中…" : "回答者アカウントに変更する"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void changeRole("both")}
            >
              {pending === "both" ? "変更中…" : "相談・回答両方出来るアカウントに変更する"}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void changeRole("consulter")}
            >
              {pending === "consulter" ? "変更中…" : "相談者アカウントに変更する"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void changeRole("both")}
            >
              {pending === "both" ? "変更中…" : "相談・回答両方出来るアカウントに変更する"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
