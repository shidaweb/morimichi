import Link from "next/link";

const links = [
  { href: "/consultations", label: "相談一覧" },
  { href: "/support", label: "支援リンク" },
  { href: "/login", label: "ログイン" },
  { href: "/register", label: "登録" },
];

export function MobileNav() {
  return (
    <nav
      className="border-border/80 bg-background/95 fixed bottom-0 left-0 right-0 z-30 flex border-t px-2 py-2 md:hidden"
      aria-label="モバイルメニュー"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="text-muted-foreground hover:text-foreground flex-1 py-2 text-center text-xs font-medium"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
