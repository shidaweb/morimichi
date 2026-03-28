import type { ContentStatus, UserRole } from "@/types/database";

export type ConsultationPhaseSummary = {
  name: string;
  slug: string;
  icon: string | null;
};

/** 公認再生プロの専門タグ表示用（profiles.pro_specialty + マスタ） */
export type ConsultationAuthorProSpecialty = {
  slug: string;
  name: string;
  icon: string | null;
};

export type ConsultationAuthorSummary = {
  nickname: string;
  avatar_url: string | null;
  is_profile_public: boolean;
  role: UserRole;
  is_certified_pro?: boolean;
  pro_specialty?: ConsultationAuthorProSpecialty | null;
};

export type ConsultationListItem = {
  id: string;
  user_id: string | null;
  phase_id: string;
  title: string;
  body: string;
  status: ContentStatus;
  crisis_flag: boolean | null;
  view_count: number | null;
  reply_count: number | null;
  reaction_count: number | null;
  created_at: string;
  updated_at: string;
  phase: ConsultationPhaseSummary | null;
  author: ConsultationAuthorSummary | null;
};
