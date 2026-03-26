export type ReplyPublic = {
  id: string;
  consultation_id: string;
  parent_reply_id: string | null;
  body: string;
  depth: number;
  created_at: string;
  nickname: string | null;
  empathyCount: number;
  hasMyEmpathy: boolean;
};

export type ConsultationReactionsSummary = {
  empathyCount: number;
  hasMyEmpathy: boolean;
};
