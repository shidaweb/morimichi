"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { clearAuthCookies } from "@/lib/auth/sync-session";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";

export function UserNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useSupabaseBrowser();

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

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/mypage"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        マイページ
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
