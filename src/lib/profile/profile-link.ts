import type { UserRole } from "@/types/database";

/** 回答者プロフィール (/users/:nickname) への導線。非公開でも回答者なら表示（Phase 2）。 */
export function canShowPublicProfileLink(input: {
  nickname: string | null;
  profile_public: boolean;
  author_role: UserRole | null;
}): boolean {
  if (!input.nickname) return false;
  if (!input.author_role || input.author_role === "consulter") return false;
  return (
    input.author_role === "advisor" ||
    input.author_role === "both" ||
    input.author_role === "moderator" ||
    input.author_role === "admin"
  );
}
