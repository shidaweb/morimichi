"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShareButtonsProps = {
  url: string;
  title: string;
};

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearToastTimer(), [clearToastTimer]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setToast({ open: true, message: "リンクをコピーしました" });
      clearToastTimer();
      toastTimerRef.current = setTimeout(() => {
        setToast((t) => ({ ...t, open: false }));
      }, 2200);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast({ open: true, message: "コピーに失敗しました" });
      clearToastTimer();
      toastTimerRef.current = setTimeout(() => {
        setToast((t) => ({ ...t, open: false }));
      }, 2200);
    }
  }

  return (
    <div className="relative space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
        共有する
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm",
            "hover:bg-muted",
          )}
        >
          𝕏 ポスト
        </a>
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm",
            "hover:bg-muted",
          )}
        >
          LINE で送る
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm",
            "hover:bg-muted",
          )}
        >
          Facebook
        </a>
        <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "コピーしました" : "リンクをコピー"}
        </Button>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-hidden={!toast.open}
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-md",
          toast.open ? "opacity-100" : "opacity-0",
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
