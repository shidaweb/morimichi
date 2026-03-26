"use client";

import { useState } from "react";

import { ConsultationCard } from "@/components/consultation/ConsultationCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConsultations } from "@/hooks/useConsultations";
import type { SortMode } from "@/lib/consultation-cursor";
import type { Database } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];

type Props = {
  phases: PhaseRow[];
};

export function ConsultationsList({ phases }: Props) {
  const [phaseTab, setPhaseTab] = useState("all");
  const [sort, setSort] = useState<SortMode>("new");
  const { items, nextCursor, loading, loadingMore, error, loadMore } =
    useConsultations(phaseTab, sort);

  return (
    <div className="space-y-6">
      <Tabs value={phaseTab} onValueChange={setPhaseTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-xs sm:text-sm"
            >
              すべて
            </TabsTrigger>
            {phases.map((p) => (
              <TabsTrigger
                key={p.id}
                value={p.slug}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-xs sm:text-sm"
              >
                <span className="mr-1">{p.icon}</span>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">並び替え</span>
        {(
          [
            { v: "new" as const, label: "新着" },
            { v: "replies" as const, label: "回答が多い" },
            { v: "views" as const, label: "閲覧が多い" },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.v}
            type="button"
            size="sm"
            variant={sort === opt.v ? "default" : "outline"}
            onClick={() => setSort(opt.v)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="text-muted-foreground text-sm">読み込み中…</div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          まだ相談がありません。最初の一歩を踏み出してみませんか。
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <ConsultationCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? "読み込み中…" : "さらに読み込む"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
