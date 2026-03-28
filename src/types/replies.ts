import type { UserRole } from "@/types/database";

export type ReplyPublic = {
  id: string;
  consultation_id: string;
  parent_reply_id: string | null;
  body: string;
  depth: number;
  created_at: string;
  nickname: string | null;
  avatar_url: string | null;
  profile_public: boolean;
  author_role: UserRole | null;
  empathyCount: number;
  hasMyEmpathy: boolean;
};

export type ConsultationReactionsSummary = {
  empathyCount: number;
  hasMyEmpathy: boolean;
};
