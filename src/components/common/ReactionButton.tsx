"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactionTarget } from "@/types/database";

type Props = {
  targetType: ReactionTarget;
  targetId: string;
  initialActive: boolean;
  initialCount: number;
  isLoggedIn: boolean;
  /** 自分の投稿には共感不可（Phase 7） */
  isOwnContent?: boolean;
  label?: string;
  size?: "sm" | "default";
  /** Runs after a successful toggle (e.g. refetch thread summary). */
  onAfterToggle?: () => void;
};

export function ReactionButton({
  targetType,
  targetId,
  initialActive,
  initialCount,
  isLoggedIn,
  isOwnContent = false,
  label = "共感",
  size = "sm",
  onAfterToggle,
}: Props) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setActive(initialActive);
    setCount(initialCount);
  }, [initialActive, initialCount]);

  async function toggle() {
    if (!isLoggedIn || pending || isOwnContent) return;
    setPending(true);
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetType, targetId }),
      });
      const j = (await res.json()) as { active?: boolean; error?: string };
      if (!res.ok && j.error === "cannot_react_own") {
        return;
      }
      if (res.ok && typeof j.active === "boolean") {
        setActive(j.active);
        setCount((c) => c + (j.active ? 1 : -1));
        router.refresh();
        onAfterToggle?.();
      }
    } finally {
      setPending(false);
    }
  }

  if (isOwnContent) {
    return (
      <span
        className="text-muted-foreground inline-flex items-center gap-1 text-sm tabular-nums"
        title="自分の投稿には共感できません"
      >
        <Heart className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2} />
        {label}{" "}
        <span>{Math.max(0, count)}</span>
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size={size}
      disabled={!isLoggedIn || pending}
      onClick={() => void toggle()}
      title={!isLoggedIn ? "ログインすると共感できます" : undefined}
    >
      <Heart
        className={cn(
          "mr-1 h-3.5 w-3.5 shrink-0",
          active ? "text-red-500" : "text-muted-foreground",
        )}
        fill={active ? "currentColor" : "none"}
        aria-hidden
        strokeWidth={2}
      />
      {label}{" "}
      <span className="text-muted-foreground tabular-nums">
        {Math.max(0, count)}
      </span>
    </Button>
  );
}
