"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { UserAvatar } from "@/components/ui/user-avatar";
import { clearAuthCookies } from "@/lib/auth/sync-session";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";
import { cn } from "@/lib/utils";

type Me = { nickname: string; avatar_url: string | null };

export function UserNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/users/me", { credentials: "include" });
        if (!res.ok) return;
        const j = (await res.json()) as { nickname?: string; avatar_url?: string | null };
        if (!cancelled) {
          setMe({
            nickname: typeof j.nickname === "string" ? j.nickname : "",
            avatar_url: j.avatar_url ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayMe = user ? me : null;

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    await clearAuthCookies();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <div className="bg-muted h-9 w-24 animate-pulse rounded-md" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          ログイン
        </Link>
        <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
          登録
        </Link>
      </div>
    );
  }

  const nick = displayMe?.nickname?.trim() || "マイページ";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/mypage"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "hidden max-w-[10rem] items-center gap-2 sm:inline-flex",
        )}
        title={nick}
      >
        <UserAvatar avatarUrl={displayMe?.avatar_url} nickname={nick} size="sm" />
        <span className="truncate">マイページ</span>
      </Link>
      <Link
        href="/mypage"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex sm:hidden")}
        aria-label="マイページ"
      >
        <UserAvatar avatarUrl={displayMe?.avatar_url} nickname={nick} size="sm" />
      </Link>
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={!supabase}
        onClick={() => void handleLogout()}
      >
        ログアウト
      </Button>
    </div>
  );
}
