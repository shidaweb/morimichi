import Link from "next/link";
import { Suspense } from "react";

import { LatestConsultations } from "@/components/consultation/LatestConsultations";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-6 pt-4 md:pt-8">
        <p className="text-primary text-sm font-medium tracking-wide">
          早期事業再生コミュニティ（MVP）
        </p>
        <h1 className="text-foreground max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          経営のしんどさを、匿名で吐き出してみませんか。
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
          ここは掲示板のように読み進められる場所です。経験してきた人の声に触れられるかもしれません。一人じゃないかもしれません。
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/consultations/new"
            prefetch={false}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            相談してみる
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            経験を活かして回答する
          </Link>
        </div>
      </section>
      <section className="border-border rounded-2xl border bg-card/50 p-6 md:p-8">
        <h2 className="text-lg font-semibold">最新の相談</h2>
        <div className="mt-4">
          <Suspense
            fallback={
              <p className="text-muted-foreground text-sm">読み込み中…</p>
            }
          >
            <LatestConsultations />
          </Suspense>
        </div>
        <Link
          href="/consultations"
          prefetch={true}
          className={cn(buttonVariants({ variant: "link" }), "mt-6 inline-flex px-0")}
        >
          相談一覧へ
        </Link>
      </section>
    </div>
  );
}
