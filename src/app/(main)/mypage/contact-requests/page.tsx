"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Sent = {
  id: string;
  target_nickname: string;
  subject: string;
  status: string;
  created_at: string;
};

type Incoming = {
  id: string;
  requester_nickname: string;
  subject: string;
  message: string;
  status: string;
  forwarded_at: string | null;
};

export default function MyContactRequestsPage() {
  const [sent, setSent] = useState<Sent[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [sRes, iRes] = await Promise.all([
        fetch("/api/my/contact-requests", { credentials: "include" }),
        fetch("/api/pro/contact-requests", { credentials: "include" }),
      ]);
      if (sRes.status === 401) {
        setErr("ログインが必要です");
        return;
      }
      if (sRes.ok) {
        const j = (await sRes.json()) as { requests?: Sent[] };
        setSent(j.requests ?? []);
      }
      if (iRes.ok) {
        const j = (await iRes.json()) as { requests?: Incoming[] };
        setIncoming(j.requests ?? []);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">相談リクエスト</h1>
        <Link
          href="/mypage"
          className="text-muted-foreground hover:text-foreground mt-2 inline-block text-sm underline-offset-4 hover:underline"
        >
          ← マイページ
        </Link>
      </div>

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {incoming.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">あなた宛（公認再生プロ）</h2>
          <ul className="space-y-3">
            {incoming.map((r) => (
              <li key={r.id} className="border-border rounded-lg border p-4 text-sm">
                <p className="font-medium">{r.subject}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  依頼者: {r.requester_nickname} ・ {r.status}
                </p>
                <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-xs leading-relaxed">
                  {r.message}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">送信したリクエスト</h2>
        {sent.length === 0 ? (
          <p className="text-muted-foreground text-sm">まだありません。</p>
        ) : (
          <ul className="space-y-3">
            {sent.map((r) => (
              <li key={r.id} className="border-border rounded-lg border p-4 text-sm">
                <p className="font-medium">{r.subject}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  宛先: {r.target_nickname} ・ {r.status} ・{" "}
                  {new Date(r.created_at).toLocaleString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
