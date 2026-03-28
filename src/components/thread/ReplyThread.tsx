"use client";

import Link from "next/link";
import { useState } from "react";

import { ReactionButton } from "@/components/common/ReactionButton";
import { ReportButton } from "@/components/common/ReportButton";
import { ReplyForm } from "@/components/thread/ReplyForm";
import { UserAvatar } from "@/components/ui/user-avatar";
import { canShowPublicProfileLink } from "@/lib/profile/profile-link";
import type { ReplyNode } from "@/lib/reply-tree";

type Props = {
  consultationId: string;
  nodes: ReplyNode[];
  isLoggedIn: boolean;
  onMutate: () => void | Promise<void>;
};

function ReplyItem({
  consultationId,
  node,
  isLoggedIn,
  onMutate,
}: {
  consultationId: string;
  node: ReplyNode;
  isLoggedIn: boolean;
  onMutate: () => void | Promise<void>;
}) {
  const [showNestedForm, setShowNestedForm] = useState(false);
  const canNest = node.depth === 1;

  return (
    <li className="space-y-3">
      <article
        className={
          node.depth === 2
            ? "border-border bg-muted/20 ml-4 border-l-2 py-2 pl-4 md:ml-8"
            : "border-border rounded-lg border p-4"
        }
      >
        <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-2 text-xs">
          <UserAvatar
            avatarUrl={node.avatar_url}
            nickname={node.nickname ?? "?"}
            size="md"
            className="shrink-0"
          />
          {canShowPublicProfileLink({
            nickname: node.nickname,
            profile_public: node.profile_public,
            author_role: node.author_role,
          }) ? (
            <Link
              href={`/users/${encodeURIComponent(node.nickname!)}`}
              className="font-medium text-foreground hover:underline"
              prefetch={false}
            >
              {node.nickname}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{node.nickname ?? "匿名"}</span>
          )}
          <time dateTime={node.created_at}>
            {new Date(node.created_at).toLocaleString("ja-JP", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{node.body}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ReactionButton
            targetType="reply"
            targetId={node.id}
            initialActive={node.hasMyEmpathy}
            initialCount={node.empathyCount}
            isLoggedIn={isLoggedIn}
          />
          <ReportButton
            targetType="reply"
            targetId={node.id}
            isLoggedIn={isLoggedIn}
          />
          {canNest ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
              onClick={() => setShowNestedForm((v) => !v)}
            >
              {showNestedForm ? "返信フォームを閉じる" : "この回答に返信"}
            </button>
          ) : null}
        </div>
        {canNest && showNestedForm ? (
          <div className="mt-4 border-t pt-4">
            <ReplyForm
              consultationId={consultationId}
              parentReplyId={node.id}
              isTopLevel={false}
              isLoggedIn={isLoggedIn}
              onSuccess={async () => {
                setShowNestedForm(false);
                await onMutate();
              }}
            />
          </div>
        ) : null}
      </article>
      {node.children.length > 0 ? (
        <ul className="space-y-4">
          {node.children.map((child) => (
            <ReplyItem
              key={child.id}
              consultationId={consultationId}
              node={child}
              isLoggedIn={isLoggedIn}
              onMutate={onMutate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ReplyThread({
  consultationId,
  nodes,
  isLoggedIn,
  onMutate,
}: Props) {
  if (nodes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">まだ回答はありません。</p>
    );
  }

  return (
    <ul className="space-y-6">
      {nodes.map((node) => (
        <ReplyItem
          key={node.id}
          consultationId={consultationId}
          node={node}
          isLoggedIn={isLoggedIn}
          onMutate={onMutate}
        />
      ))}
    </ul>
  );
}
