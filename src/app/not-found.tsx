import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-primary text-sm font-medium">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          ページが見つかりませんでした
        </h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          リンクが古いか、移動した可能性があります。トップに戻って、落ち着いたペースで探してみてください。
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants())}>
        トップへ
      </Link>
    </div>
  );
}
