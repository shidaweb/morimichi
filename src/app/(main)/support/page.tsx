import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupportCategory } from "@/types/database";

const CATEGORY_LABEL: Record<SupportCategory, string> = {
  public: "公的・総合",
  legal: "法律",
  financial: "金融・再生",
  mental: "メンタル・いのちの相談",
  other: "その他",
};

export default async function SupportPage() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">支援リンク</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          データの読み込みに必要な設定が不足しています。
        </p>
      </div>
    );
  }

  const { data: links, error } = await supabase
    .from("support_links")
    .select("id,name,category,description,url,phone_number,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
  }

  const rows = links ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">支援リンク</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          公的窓口や相談窓口へのリンクです。緊急時は最寄りの窓口や
          <span className="whitespace-nowrap"> 110・119 </span>
          へご連絡ください。
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          現在表示できるリンクがありません。
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
                      {CATEGORY_LABEL[row.category as SupportCategory]}
                    </span>
                    <h2 className="text-base font-semibold">{row.name}</h2>
                  </div>
                  {row.description ? (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {row.description}
                    </p>
                  ) : null}
                  {row.phone_number ? (
                    <p className="text-sm tabular-nums">
                      電話: {row.phone_number}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary shrink-0 text-sm font-medium hover:underline"
                >
                  サイトを開く
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
