import Link from "next/link";
import { redirect } from "next/navigation";

import { getModeratorContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const nav = [
  { href: "/admin/reports", label: "通報" },
  { href: "/admin/consultations", label: "投稿" },
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/pro/applications", label: "公認プロ申請" },
  { href: "/admin/contact-requests", label: "相談リクエスト" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    redirect("/login?next=/admin/reports");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/admin/reports");
  }

  const mod = await getModeratorContext(supabase);
  if (!mod) {
    redirect("/");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-muted-foreground text-sm font-medium">管理</h1>
        <nav className="mt-3 flex flex-wrap gap-2 border-b border-border pb-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
