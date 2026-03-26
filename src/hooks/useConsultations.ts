"use client";

import { useCallback, useEffect, useState } from "react";

import type { SortMode } from "@/lib/consultation-cursor";
import type { ConsultationListItem } from "@/types/consultations";

export function useConsultations(phaseSlug: string, sort: SortMode) {
  const [items, setItems] = useState<ConsultationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (opts: { append: boolean; cursor: string | null }) => {
      const params = new URLSearchParams();
      params.set("phase", phaseSlug);
      params.set("sort", sort);
      if (opts.cursor) params.set("cursor", opts.cursor);
      const res = await fetch(`/api/consultations?${params.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: string;
        items?: ConsultationListItem[];
        nextCursor?: string | null;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "読み込みに失敗しました");
      }
      const list = json.items ?? [];
      if (opts.append) {
        setItems((prev) => [...prev, ...list]);
      } else {
        setItems(list);
      }
      setNextCursor(json.nextCursor ?? null);
    },
    [phaseSlug, sort],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchPage({ append: false, cursor: null });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phaseSlug, sort, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({ append: true, cursor: nextCursor });
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    }
    setLoadingMore(false);
  }, [fetchPage, nextCursor, loadingMore]);

  return {
    items,
    nextCursor,
    loading,
    loadingMore,
    error,
    loadMore,
  };
}
