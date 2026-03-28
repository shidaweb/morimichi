import Link from "next/link";

type MobileNavLink = {
  href: string;
  label: string;
  title?: string;
  prefetch?: boolean;
};

const links: MobileNavLink[] = [
  { href: "/consultations", label: "相談一覧", prefetch: true },
  { href: "/support", label: "支援リンク", prefetch: true },
  { href: "/register", label: "登録" },
  {
    href: "/sponsors",
    label: "スポンサー",
    title: "もりみちスポンサー一覧",
    prefetch: true,
  },
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
          title={l.title}
          prefetch={l.prefetch ?? false}
          className="text-muted-foreground hover:text-foreground flex-1 py-2 text-center text-xs font-medium"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
