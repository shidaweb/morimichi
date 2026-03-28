"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { clearAuthCookies } from "@/lib/auth/sync-session";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/consultations", label: "相談一覧", prefetch: true as const },
  { href: "/support", label: "支援リンク", prefetch: true as const },
  { href: "/sponsors", label: "もりみちスポンサー一覧", prefetch: true as const },
];

type LineCoords = { x1: number; x2: number };

const LINES_REST: LineCoords[] = [
  { x1: 0, x2: 24 },
  { x1: 2, x2: 22 },
  { x1: 5, x2: 20 },
];

const LINES_EXPAND: LineCoords[] = [
  { x1: 0, x2: 26 },
  { x1: 0, x2: 26 },
  { x1: 0, x2: 26 },
];

function subscribeNothing() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

function MoriHamburgerIcon({
  open,
  hoverExpand,
}: {
  open: boolean;
  hoverExpand: boolean;
}) {
  const lines = !open && hoverExpand ? LINES_EXPAND : LINES_REST;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 28"
      width={32}
      height={28}
      fill="none"
      aria-hidden="true"
      className="pointer-events-none"
    >
      <line
        x1={lines[0].x1}
        y1={4}
        x2={lines[0].x2}
        y2={4}
        stroke="var(--mori-ham-1, #80ed99)"
        strokeWidth={3}
        strokeLinecap="round"
        className="header-hamburger-line"
      />
      <circle
        cx={27}
        cy={4}
        r={2}
        fill="var(--mori-ham-1, #80ed99)"
        className="header-hamburger-dot"
        opacity={0.6}
      />
      <line
        x1={lines[1].x1}
        y1={14}
        x2={lines[1].x2}
        y2={14}
        stroke="var(--mori-ham-2, #4cc9f0)"
        strokeWidth={3}
        strokeLinecap="round"
        className="header-hamburger-line"
      />
      <circle
        cx={24.5}
        cy={14}
        r={1.6}
        fill="var(--mori-ham-2, #4cc9f0)"
        className="header-hamburger-dot"
        opacity={0.45}
      />
      <line
        x1={lines[2].x1}
        y1={24}
        x2={lines[2].x2}
        y2={24}
        stroke="var(--mori-ham-3, #00f5d4)"
        strokeWidth={3}
        strokeLinecap="round"
        className="header-hamburger-line"
      />
      <circle
        cx={22}
        cy={24}
        r={1.2}
        fill="var(--mori-ham-3, #00f5d4)"
        className="header-hamburger-dot"
        opacity={0.35}
      />
    </svg>
  );
}

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [hoverExpand, setHoverExpand] = useState(false);
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useSupabaseBrowser();
  const menuId = useId();

  const [me, setMe] = useState<{ nickname: string; avatar_url: string | null } | null>(null);

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

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    await clearAuthCookies();
    close();
    router.push("/");
    router.refresh();
  }

  const displayMe = user ? me : null;
  const nick = displayMe?.nickname?.trim() || "マイページ";

  const overlay = open ? (
      <div className="fixed top-14 right-0 bottom-0 left-0 z-50 flex justify-end">
        <button
          type="button"
          className="bg-foreground/20 absolute inset-0 cursor-default backdrop-blur-[2px]"
          aria-label="メニューを閉じる"
          onClick={close}
        />
        <div
          ref={panelRef}
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-label="サイトメニュー"
          className="border-border bg-card relative z-10 flex h-full w-full max-w-sm flex-col border-l shadow-xl"
        >
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">メニュー</span>
            <Button type="button" variant="ghost" size="sm" onClick={close} className="shrink-0">
              閉じる
            </Button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4" aria-label="主要ナビゲーション">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.prefetch}
                onClick={close}
                className="text-foreground hover:bg-muted/80 rounded-lg px-3 py-3 text-base font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-border mt-auto border-t p-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide">アカウント</p>
            {loading ? (
              <div className="bg-muted h-10 animate-pulse rounded-md" aria-hidden />
            ) : !user ? (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  prefetch={false}
                  onClick={close}
                  className="text-foreground hover:bg-muted/80 rounded-lg px-3 py-3 text-center text-base font-medium transition-colors"
                >
                  ログイン
                </Link>
                <Link
                  href="/register"
                  prefetch={false}
                  onClick={close}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-3 text-center text-base font-medium transition-colors"
                >
                  登録
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  href="/mypage"
                  prefetch={false}
                  onClick={close}
                  className="hover:bg-muted/80 flex items-center gap-3 rounded-lg px-3 py-3 transition-colors"
                >
                  <UserAvatar avatarUrl={displayMe?.avatar_url} nickname={nick} size="md" />
                  <span className="font-medium">マイページ</span>
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  disabled={!supabase}
                  onClick={() => void handleLogout()}
                >
                  ログアウト
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "header-hamburger flex shrink-0 items-center justify-center rounded-md",
          open && "is-open",
          hoverExpand && !open && "hover-expand",
        )}
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHoverExpand(true)}
        onMouseLeave={() => setHoverExpand(false)}
      >
        <MoriHamburgerIcon open={open} hoverExpand={hoverExpand} />
      </button>
      {isClient && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
