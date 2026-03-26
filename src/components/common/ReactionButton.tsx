"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ReactionTarget } from "@/types/database";

type Props = {
  targetType: ReactionTarget;
  targetId: string;
  initialActive: boolean;
  initialCount: number;
  isLoggedIn: boolean;
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
    if (!isLoggedIn || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetType, targetId }),
      });
      const j = (await res.json()) as { active?: boolean };
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

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size={size}
      disabled={!isLoggedIn || pending}
      onClick={() => void toggle()}
      title={!isLoggedIn ? "ログインすると共感できます" : undefined}
    >
      {active ? "❤" : "♡"} {label}{" "}
      <span className="text-muted-foreground tabular-nums">
        {Math.max(0, count)}
      </span>
    </Button>
  );
}
