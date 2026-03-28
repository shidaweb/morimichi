import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { MORIMICHI_SPONSORS } from "@/lib/sponsors";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "もりみちスポンサー一覧",
  description:
    "もりみちをご支援いただいているスポンサー企業のご芳名を掲載しています。",
};

export default function SponsorsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">もりみちスポンサー一覧</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          もりみちはサイトのスポンサー企業を募っています。スポンサー企業はこの一覧にご芳名を掲載します。企業再生に少しでもご支援のご意向があることをささやかながらアピールさせていただきます。
        </p>
      </div>

      <section className="border-border space-y-4 rounded-xl border bg-card/40 p-6" aria-labelledby="sponsors-list-heading">
        <h2 id="sponsors-list-heading" className="text-lg font-semibold tracking-tight">
          スポンサー企業一覧
        </h2>
        {MORIMICHI_SPONSORS.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            現在、掲載中のスポンサー企業はありません。掲載の準備が整い次第、こちらにご芳名をお並べいたします。
          </p>
        ) : (
          <ul className="space-y-3">
            {MORIMICHI_SPONSORS.map((s) => (
              <li key={s.name} className="border-border/80 border-b pb-3 last:border-0 last:pb-0">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    {s.name}
                  </a>
                ) : (
                  <span className="font-medium">{s.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex px-0")}>
        トップへ戻る
      </Link>
    </div>
  );
}
