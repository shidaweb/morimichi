"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { syncAuthCookies } from "@/lib/auth/sync-session";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";

type Status = "checking" | "success" | "error";

export function VerifyEmailClient() {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("認証状態を確認しています…");

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let syncing = false;

    const finalize = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled || syncing) return;
      if (error || !data.session) {
        const u = new URL(window.location.href);
        const code = u.searchParams.get("code");
        if (!code) {
          setStatus("error");
          return;
        }
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled || !exchanged.data.session) {
          setStatus("error");
          return;
        }
      }

      const { data: after } = await supabase.auth.getSession();
      if (cancelled || !after.session) return;

      syncing = true;
      try {
        await syncAuthCookies(
          after.session.access_token,
          after.session.refresh_token,
        );
        const boot = await fetch("/api/profile/bootstrap", { method: "POST" });
        if (!boot.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        if (!cancelled) {
          setStatus("success");
          setMessage("メール認証が完了しました。相談一覧へ移動します。");
          setTimeout(() => router.replace("/consultations"), 700);
        }
      } catch {
        if (!cancelled) setStatus("error");
      } finally {
        syncing = false;
      }
    };

    void finalize();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !syncing) {
        void finalize();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (status === "success") {
    return (
      <Alert>
        <AlertTitle>認証が完了しました</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>認証を完了していません。</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>メールのリンクをクリックして、認証を完了してください。</p>
          <div>
            <Link href="/login" className="underline underline-offset-4">
              ログインへ進む
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        再確認
      </Button>
    </div>
  );
}

