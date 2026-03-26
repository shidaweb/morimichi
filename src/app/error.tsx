"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-primary text-sm font-medium">エラー</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          うまく表示できませんでした
        </h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          一時的な不具合かもしれません。少し時間をおいてから、もう一度試してみてください。
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" variant="outline" onClick={() => reset()}>
          再読み込み
        </Button>
        <Link href="/" className={cn(buttonVariants())}>
          トップへ
        </Link>
      </div>
    </div>
  );
}
