import type { UserRole } from "@/types/database";

export function canShowPublicProfileLink(input: {
  nickname: string | null;
  profile_public: boolean;
  author_role: UserRole | null;
}): boolean {
  if (!input.nickname) return false;
  if (!input.profile_public) return false;
  if (!input.author_role || input.author_role === "consulter") return false;
  return true;
}
