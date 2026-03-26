"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

import { ReactionButton } from "@/components/common/ReactionButton";
import { ReportButton } from "@/components/common/ReportButton";
import { ConsultationViewRecorder } from "@/components/consultation/ConsultationViewRecorder";
import { ViewCounter } from "@/components/consultation/ViewCounter";
import { ReplyForm } from "@/components/thread/ReplyForm";
import { ReplyThread } from "@/components/thread/ReplyThread";
import { buildReplyTree, type ReplyNode } from "@/lib/reply-tree";
import type { ConsultationReactionsSummary, ReplyPublic } from "@/types/replies";

type Props = {
  consultationId: string;
  initialViewCount: number;
  initialReplyCount: number;
  initialReactionCount: number;
  initialReplies: ReplyPublic[];
  initialConsultationReaction: ConsultationReactionsSummary;
  initialThreadError: string | null;
  canPostTopLevel: boolean;
  isLoggedIn: boolean;
  children?: ReactNode;
};

export function ConsultationDetailClient({
  consultationId,
  initialViewCount,
  initialReplyCount,
  initialReactionCount,
  initialReplies,
  initialConsultationReaction,
  initialThreadError,
  canPostTopLevel,
  isLoggedIn,
  children,
}: Props) {
  const router = useRouter();
  const [tree, setTree] = useState<ReplyNode[]>(() =>
    buildReplyTree(initialReplies),
  );
  const [consultationReaction, setConsultationReaction] = useState(
    initialConsultationReaction,
  );
  const [threadError, setThreadError] = useState(initialThreadError);

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/consultations/${consultationId}/replies`, {
        credentials: "include",
      });
      if (!res.ok) {
        setThreadError("回答の読み込みに失敗しました");
        return;
      }
      const j = (await res.json()) as {
        replies: ReplyPublic[];
        consultationReaction: ConsultationReactionsSummary;
      };
      setThreadError(null);
      setTree(buildReplyTree(j.replies ?? []));
      setConsultationReaction(j.consultationReaction);
    } catch {
      setThreadError("通信エラーが発生しました");
    }
  }, [consultationId]);

  const refreshAll = useCallback(async () => {
    await loadThread();
    router.refresh();
  }, [loadThread, router]);

  const hasMyConsultationEmpathy = consultationReaction.hasMyEmpathy;
  const consultationEmpathyCount =
    consultationReaction.empathyCount ?? initialReactionCount;

  return (
    <div className="space-y-8">
      <ConsultationViewRecorder
        consultationId={consultationId}
        onRecorded={(counted) => {
          if (counted) router.refresh();
        }}
      />

      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
        <ViewCounter count={initialViewCount} />
        <span>💬 {initialReplyCount.toLocaleString("ja-JP")}回答</span>
        <div className="flex flex-wrap items-center gap-2">
          <ReactionButton
            targetType="consultation"
            targetId={consultationId}
            initialActive={hasMyConsultationEmpathy}
            initialCount={consultationEmpathyCount}
            isLoggedIn={isLoggedIn}
            label="共感"
            onAfterToggle={() => void loadThread()}
          />
          <ReportButton
            targetType="consultation"
            targetId={consultationId}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>

      {children}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">回答</h2>
        {threadError ? (
          <p className="text-destructive text-sm">{threadError}</p>
        ) : null}
        <ReplyThread
          consultationId={consultationId}
          nodes={tree}
          isLoggedIn={isLoggedIn}
          onMutate={refreshAll}
        />
      </section>

      {canPostTopLevel ? (
        <section className="border-border space-y-3 border-t pt-6">
          <h2 className="text-lg font-semibold tracking-tight">
            回答を投稿
          </h2>
          <p className="text-muted-foreground text-sm">
            トップレベルの回答は、登録時に「回答者」または「両方」を選んだ方のみ投稿できます。
          </p>
          <ReplyForm
            consultationId={consultationId}
            isTopLevel
            isLoggedIn={isLoggedIn}
            disabled={!isLoggedIn}
            onSuccess={refreshAll}
          />
        </section>
      ) : isLoggedIn ? (
        <p className="text-muted-foreground text-sm">
          トップレベルの回答を投稿するには、プロフィールで「回答者」または「両方」を選んで登録してください。深い返信（2段目）は、ログインしていれば誰でも投稿できます。
        </p>
      ) : null}
    </div>
  );
}
