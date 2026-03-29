import type { UserRole } from "@/types/database";

export type ReplyAuthorProSpecialty = {
  slug: string;
  name: string;
  icon: string | null;
};

export type ReplyPublic = {
  id: string;
  consultation_id: string;
  parent_reply_id: string | null;
  body: string;
  depth: number;
  created_at: string;
  author_user_id: string | null;
  nickname: string | null;
  avatar_url: string | null;
  profile_public: boolean;
  author_role: UserRole | null;
  is_certified_pro?: boolean;
  pro_specialty?: ReplyAuthorProSpecialty | null;
  empathyCount: number;
  hasMyEmpathy: boolean;
};

export type ConsultationReactionsSummary = {
  empathyCount: number;
  hasMyEmpathy: boolean;
};
