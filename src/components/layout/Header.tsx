import Link from "next/link";

import { UserNav } from "@/components/layout/UserNav";
import { SITE_NAME } from "@/lib/constants";

const nav = [
  { href: "/consultations", label: "相談一覧" },
  { href: "/support", label: "支援リンク" },
  { href: "/sponsors", label: "もりみちスポンサー一覧" },
];

export function Header() {
  return (
    <header className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="text-primary font-semibold tracking-tight"
        >
          {SITE_NAME}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className="text-foreground/80 hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <UserNav />
      </div>
    </header>
  );
}
