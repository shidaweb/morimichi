import type { ContentStatus } from "@/types/database";

export type ConsultationPhaseSummary = {
  name: string;
  slug: string;
  icon: string | null;
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
};
