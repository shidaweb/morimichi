import Link from "next/link";

import { HeaderMenu } from "@/components/layout/HeaderMenu";
import { SITE_NAME } from "@/lib/constants";

export function Header() {
  return (
    <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-[100] border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-primary min-w-0 truncate font-semibold tracking-tight">
          {SITE_NAME}
        </Link>
        <HeaderMenu />
      </div>
    </header>
  );
}
