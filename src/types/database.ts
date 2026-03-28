export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | "consulter"
  | "advisor"
  | "both"
  | "moderator"
  | "admin";

export type UserStatus = "active" | "suspended" | "banned" | "withdrawn";

export type ContentStatus = "published" | "hidden" | "deleted";

export type ReactionTarget = "consultation" | "reply";

export type ReportReason =
  | "defamation"
  | "solicitation"
  | "crisis"
  | "personal_info"
  | "illegal"
  | "misinformation"
  | "legal_advice"
  | "advisor_solicitation"
  | "spam"
  | "other";

export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export type ModerationActionType =
  | "hide"
  | "delete"
  | "warn"
  | "suspend"
  | "ban"
  | "no_action";

export type SupportCategory =
  | "public"
  | "legal"
  | "financial"
  | "mental"
  | "other";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          status: UserStatus;
          nickname: string;
          bio: string | null;
          experience_phases: string[] | null;
          avatar_url: string | null;
          headline: string | null;
          prefecture: string | null;
          years_of_experience: number | null;
          is_profile_public: boolean;
          website_url: string | null;
          notification_on_reply: boolean | null;
          notification_on_reaction: boolean | null;
          notification_digest: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: UserRole;
          status?: UserStatus;
          nickname: string;
          bio?: string | null;
          experience_phases?: string[] | null;
          avatar_url?: string | null;
          headline?: string | null;
          prefecture?: string | null;
          years_of_experience?: number | null;
          is_profile_public?: boolean;
          website_url?: string | null;
          notification_on_reply?: boolean | null;
          notification_on_reaction?: boolean | null;
          notification_digest?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: UserRole;
          status?: UserStatus;
          nickname?: string;
          bio?: string | null;
          experience_phases?: string[] | null;
          avatar_url?: string | null;
          headline?: string | null;
          prefecture?: string | null;
          years_of_experience?: number | null;
          is_profile_public?: boolean;
          website_url?: string | null;
          notification_on_reply?: boolean | null;
          notification_on_reaction?: boolean | null;
          notification_digest?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      phases: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          description: string | null;
          sort_order: number;
          is_active: boolean | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string | null;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean | null;
        };
        Relationships: [];
      };
      concerns: {
        Row: {
          id: string;
          phase_id: string;
          label: string;
          sort_order: number;
          is_active: boolean | null;
          triggers_crisis: boolean | null;
        };
        Insert: {
          id?: string;
          phase_id: string;
          label: string;
          sort_order?: number;
          is_active?: boolean | null;
          triggers_crisis?: boolean | null;
        };
        Update: {
          id?: string;
          phase_id?: string;
          label?: string;
          sort_order?: number;
          is_active?: boolean | null;
          triggers_crisis?: boolean | null;
        };
        Relationships: [];
      };
      consultations: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          phase_id: string;
          title: string;
          body: string;
          status?: ContentStatus;
          crisis_flag?: boolean | null;
          view_count?: number | null;
          reply_count?: number | null;
          reaction_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          phase_id?: string;
          title?: string;
          body?: string;
          status?: ContentStatus;
          crisis_flag?: boolean | null;
          view_count?: number | null;
          reply_count?: number | null;
          reaction_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      consultation_concerns: {
        Row: {
          id: string;
          consultation_id: string;
          concern_id: string;
        };
        Insert: {
          id?: string;
          consultation_id: string;
          concern_id: string;
        };
        Update: {
          id?: string;
          consultation_id?: string;
          concern_id?: string;
        };
        Relationships: [];
      };
      replies: {
        Row: {
          id: string;
          consultation_id: string;
          user_id: string | null;
          parent_reply_id: string | null;
          body: string;
          depth: number;
          status: ContentStatus;
          personal_opinion_ack: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consultation_id: string;
          user_id?: string | null;
          parent_reply_id?: string | null;
          body: string;
          depth?: number;
          status?: ContentStatus;
          personal_opinion_ack?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          consultation_id?: string;
          user_id?: string | null;
          parent_reply_id?: string | null;
          body?: string;
          depth?: number;
          status?: ContentStatus;
          personal_opinion_ack?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          reaction_type: "empathy";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          reaction_type?: "empathy";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_type?: ReactionTarget;
          target_id?: string;
          reaction_type?: "empathy";
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          reason: ReportReason;
          detail: string | null;
          status: ReportStatus;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          reason: ReportReason;
          detail?: string | null;
          status?: ReportStatus;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_user_id?: string;
          target_type?: ReactionTarget;
          target_id?: string;
          reason?: ReportReason;
          detail?: string | null;
          status?: ReportStatus;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      moderation_actions: {
        Row: {
          id: string;
          moderator_user_id: string;
          report_id: string | null;
          target_type: "consultation" | "reply" | "user";
          target_id: string;
          action: ModerationActionType;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          moderator_user_id: string;
          report_id?: string | null;
          target_type: "consultation" | "reply" | "user";
          target_id: string;
          action: ModerationActionType;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          moderator_user_id?: string;
          report_id?: string | null;
          target_type?: "consultation" | "reply" | "user";
          target_id?: string;
          action?: ModerationActionType;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      support_links: {
        Row: {
          id: string;
          name: string;
          category: SupportCategory;
          description: string | null;
          url: string;
          phone_number: string | null;
          is_paid_listing: boolean | null;
          is_active: boolean | null;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: SupportCategory;
          description?: string | null;
          url: string;
          phone_number?: string | null;
          is_paid_listing?: boolean | null;
          is_active?: boolean | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: SupportCategory;
          description?: string | null;
          url?: string;
          phone_number?: string | null;
          is_paid_listing?: boolean | null;
          is_active?: boolean | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      consultation_views: {
        Row: {
          id: string;
          consultation_id: string;
          viewer_id: string | null;
          ip_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          consultation_id: string;
          viewer_id?: string | null;
          ip_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          consultation_id?: string;
          viewer_id?: string | null;
          ip_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fetch_consultations: {
        Args: {
          p_phase_id?: string | null;
          p_sort?: string;
          p_limit?: number;
          p_after_created_at?: string | null;
          p_after_id?: string | null;
          p_after_reply_count?: number | null;
          p_after_view_count?: number | null;
        };
        Returns: {
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
        }[];
      };
      create_consultation_post: {
        Args: {
          p_phase_id: string;
          p_title: string;
          p_body: string;
          p_concern_ids: string[];
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      content_status: ContentStatus;
      reaction_target: ReactionTarget;
      report_reason: ReportReason;
      report_status: ReportStatus;
      moderation_action_type: ModerationActionType;
      support_category: SupportCategory;
    };
    CompositeTypes: Record<string, never>;
  };
}
