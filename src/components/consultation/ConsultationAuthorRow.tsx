import Link from "next/link";

import { UserAvatar } from "@/components/ui/user-avatar";
import { canShowPublicProfileLink } from "@/lib/profile/profile-link";
import type { ConsultationAuthorSummary } from "@/types/consultations";

type Props = {
  author: ConsultationAuthorSummary;
  /** 相談カードは md（40px 相当）、詳細は lg */
  size?: "md" | "lg";
};

export function ConsultationAuthorRow({ author, size = "md" }: Props) {
  const showLink = canShowPublicProfileLink({
    nickname: author.nickname,
    profile_public: author.is_profile_public,
    author_role: author.role,
  });

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
      <UserAvatar avatarUrl={author.avatar_url} nickname={author.nickname} size={size} />
      {showLink ? (
        <Link
          href={`/users/${encodeURIComponent(author.nickname)}`}
          className="text-foreground font-medium hover:underline"
          prefetch={false}
        >
          {author.nickname}
        </Link>
      ) : (
        <span className="text-foreground font-medium">{author.nickname}</span>
      )}
      <span className="text-muted-foreground">・投稿者</span>
    </div>
  );
}
