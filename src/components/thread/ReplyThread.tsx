"use client";

import Link from "next/link";
import { useState } from "react";

import { ReactionButton } from "@/components/common/ReactionButton";
import { ReportButton } from "@/components/common/ReportButton";
import { ContactRequestModal } from "@/components/pro/contact-request-modal";
import { ReplyForm } from "@/components/thread/ReplyForm";
import { CertifiedProBadge } from "@/components/ui/certified-pro-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { canShowPublicProfileLink } from "@/lib/profile/profile-link";
import type { ReplyNode } from "@/lib/reply-tree";
import { normalizeConsultationBodyForDisplay } from "@/lib/utils/consultation-body-display";
import type { UserRole } from "@/types/database";

type Props = {
  consultationId: string;
  nodes: ReplyNode[];
  isLoggedIn: boolean;
  viewerUserId: string | null;
  onMutate: () => void | Promise<void>;
};

function isAdvisorLike(role: UserRole | null): boolean {
  return (
    role === "advisor" ||
    role === "both" ||
    role === "admin" ||
    role === "moderator"
  );
}

/** POST /api/contact-requests と RLS と同じ対象ロール */
function isContactRequestTargetRole(role: UserRole | null): boolean {
  return role === "advisor" || role === "both" || role === "admin";
}

function ReplyItem({
  consultationId,
  node,
  isLoggedIn,
  viewerUserId,
  onMutate,
}: {
  consultationId: string;
  node: ReplyNode;
  isLoggedIn: boolean;
  viewerUserId: string | null;
  onMutate: () => void | Promise<void>;
}) {
  const [showNestedForm, setShowNestedForm] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const canNest = node.depth === 1;

  const profileHref =
    node.nickname && canShowPublicProfileLink({
      nickname: node.nickname,
      profile_public: node.profile_public,
      author_role: node.author_role,
    })
      ? `/users/${encodeURIComponent(node.nickname)}`
      : null;

  const showContactRequest =
    isLoggedIn &&
    Boolean(viewerUserId) &&
    Boolean(node.author_user_id) &&
    node.author_user_id !== viewerUserId &&
    node.depth === 1 &&
    isContactRequestTargetRole(node.author_role);

  const avatarEl = (
    <UserAvatar
      avatarUrl={node.avatar_url}
      nickname={node.nickname ?? "?"}
      size="md"
      className="shrink-0"
    />
  );

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
          {profileHref ? (
            <Link
              href={profileHref}
              className="shrink-0 rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              prefetch={false}
            >
              {avatarEl}
            </Link>
          ) : (
            avatarEl
          )}
          {profileHref ? (
            <Link
              href={profileHref}
              className="font-medium text-foreground hover:underline"
              prefetch={false}
            >
              {node.nickname}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{node.nickname ?? "匿名"}</span>
          )}
          {node.is_certified_pro ? (
            <CertifiedProBadge
              specialty={node.pro_specialty ?? null}
              size={node.depth === 1 ? "md" : "sm"}
              showSpecialty={node.depth === 1}
            />
          ) : null}
          <time dateTime={node.created_at}>
            {new Date(node.created_at).toLocaleString("ja-JP", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {normalizeConsultationBodyForDisplay(node.body)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ReactionButton
            targetType="reply"
            targetId={node.id}
            initialActive={node.hasMyEmpathy}
            initialCount={node.empathyCount}
            isLoggedIn={isLoggedIn}
            isOwnContent={
              Boolean(viewerUserId && node.author_user_id === viewerUserId)
            }
          />
          <ReportButton
            targetType="reply"
            targetId={node.id}
            isLoggedIn={isLoggedIn}
          />
          {showContactRequest && node.nickname ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
              onClick={() => setContactOpen(true)}
            >
              運営を通じてこの人に相談する
            </button>
          ) : null}
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
        {showContactRequest && node.nickname && node.author_user_id ? (
          <ContactRequestModal
            open={contactOpen}
            onClose={() => setContactOpen(false)}
            targetUserId={node.author_user_id}
            targetNickname={node.nickname}
            targetAvatarUrl={node.avatar_url}
            targetSpecialty={node.pro_specialty ?? null}
            isCertifiedPro={Boolean(node.is_certified_pro)}
          />
        ) : null}
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
              viewerUserId={viewerUserId}
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
  viewerUserId,
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
          viewerUserId={viewerUserId}
          onMutate={onMutate}
        />
      ))}
    </ul>
  );
}
