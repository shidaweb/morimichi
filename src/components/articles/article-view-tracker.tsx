"use client";

import { useEffect } from "react";

type Props = { articleId: string };

export function ArticleViewTracker({ articleId }: Props) {
  useEffect(() => {
    void fetch(`/api/articles/${articleId}/view`, { method: "POST" }).catch(() => {});
  }, [articleId]);
  return null;
}
