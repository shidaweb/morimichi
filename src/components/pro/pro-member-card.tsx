"use client";

import Link from "next/link";
import { FileText, Heart, MessageSquare } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { CertifiedProBadge } from "@/components/ui/certified-pro-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { ProSpecialtyBadge } from "@/lib/pro/pro-specialty-badge";
import { cn } from "@/lib/utils";

export type ProMemberCardMember = {
  nickname: string;
  avatar_url: string | null;
  headline: string | null;
  prefecture: string | null;
  years_of_experience: number | null;
  pro_specialty: ProSpecialtyBadge;
  experience_phases: string[];
  stats: {
    total_replies: number;
    total_reactions_received: number;
    total_articles: number;
    total_article_views: number;
  };
};

type Props = {
  member: ProMemberCardMember;
  onContactClick: (nickname: string) => void;
};

export function ProMemberCard({ member, onContactClick }: Props) {
  const loc = [member.prefecture, member.years_of_experience != null ? `経験${member.years_of_experience}年` : null]
    .filter(Boolean)
    .join(" ・ ");

  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <div className="flex items-start gap-4">
        <UserAvatar avatarUrl={member.avatar_url} nickname={member.nickname} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{member.nickname}</span>
            <CertifiedProBadge specialty={member.pro_specialty} size="sm" />
          </div>
          {member.headline ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{member.headline}</p>
          ) : null}
          {loc ? <p className="text-muted-foreground mt-1 text-xs">{loc}</p> : null}
        </div>
      </div>
      <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-4 w-4" aria-hidden />
          回答 {member.stats.total_replies}件
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="h-4 w-4" aria-hidden />
          共感 {member.stats.total_reactions_received}
        </span>
        <span className="inline-flex items-center gap-1">
          <FileText className="h-4 w-4" aria-hidden />
          コラム {member.stats.total_articles}本
        </span>
      </div>
      {member.experience_phases.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {member.experience_phases.map((phase) => (
            <span
              key={phase}
              className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
            >
              {phase}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/users/${encodeURIComponent(member.nickname)}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
        >
          プロフィールを見る
        </Link>
        <Button
          size="sm"
          className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600"
          type="button"
          onClick={() => onContactClick(member.nickname)}
        >
          運営を通じて相談する
        </Button>
      </div>
    </div>
  );
}
