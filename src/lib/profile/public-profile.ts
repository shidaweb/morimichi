import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, UserRole } from "@/types/database";

export type PublicProfilePayload = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  prefecture: string | null;
  years_of_experience: number | null;
  experience_phases: string[] | null;
  website_url: string | null;
  role: UserRole;
  created_at: string;
  is_profile_public: boolean;
};

export type PublicProfileStats = {
  total_consultations: number;
  total_replies: number;
  total_reactions_received: number;
  member_since: string;
};

export type PublicProfileJson = Omit<
  PublicProfilePayload,
  "user_id" | "is_profile_public" | "created_at"
> & {
  stats: PublicProfileStats;
};

type ViewerInfo = { user_id: string; role: UserRole } | null;

export function canViewPublicProfile(profile: PublicProfilePayload, viewer: ViewerInfo): boolean {
  if (profile.role === "consulter") {
    if (!viewer) return false;
    return viewer.role === "admin" || viewer.role === "moderator";
  }
  if (!profile.is_profile_public) {
    if (!viewer) return false;
    if (viewer.user_id === profile.user_id) return true;
    return viewer.role === "admin" || viewer.role === "moderator";
  }
  return true;
}

export async function fetchProfileStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  memberSince: string,
): Promise<PublicProfileStats> {
  const [{ count: cCount }, { count: rCount }, { data: replyRows }] = await Promise.all([
    supabase
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "published"),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "published"),
    supabase.from("replies").select("id").eq("user_id", userId).eq("status", "published"),
  ]);

  const replyIds = (replyRows ?? []).map((r) => r.id);
  let reactionCount = 0;
  if (replyIds.length > 0) {
    const { count: reactCount } = await supabase
      .from("reactions")
      .select("id", { count: "exact", head: true })
      .eq("target_type", "reply")
      .in("target_id", replyIds)
      .eq("reaction_type", "empathy");
    reactionCount = reactCount ?? 0;
  }

  return {
    total_consultations: cCount ?? 0,
    total_replies: rCount ?? 0,
    total_reactions_received: reactionCount,
    member_since: memberSince,
  };
}

export async function getPublicProfileByNickname(
  supabase: SupabaseClient<Database>,
  nickname: string,
  viewer: ViewerInfo,
): Promise<PublicProfileJson | null> {
  const full = await getPublicProfileWithUserId(supabase, nickname, viewer);
  if (!full) return null;
  const { user_id, ...json } = full;
  void user_id;
  return json;
}

/** サーバー画面用: 公開 JSON + user_id（クライアントに渡さない） */
export async function getPublicProfileWithUserId(
  supabase: SupabaseClient<Database>,
  nickname: string,
  viewer: ViewerInfo,
): Promise<(PublicProfileJson & { user_id: string }) | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "user_id, nickname, avatar_url, headline, bio, prefecture, years_of_experience, experience_phases, website_url, role, is_profile_public, created_at",
    )
    .eq("nickname", nickname)
    .maybeSingle();

  if (error || !profile) return null;

  const payload: PublicProfilePayload = {
    user_id: profile.user_id,
    nickname: profile.nickname,
    avatar_url: profile.avatar_url,
    headline: profile.headline,
    bio: profile.bio,
    prefecture: profile.prefecture,
    years_of_experience: profile.years_of_experience,
    experience_phases: profile.experience_phases,
    website_url: profile.website_url,
    role: profile.role as UserRole,
    created_at: profile.created_at,
    is_profile_public: profile.is_profile_public,
  };

  if (!canViewPublicProfile(payload, viewer)) {
    return null;
  }

  const stats = await fetchProfileStats(supabase, payload.user_id, profile.created_at);

  return {
    user_id: payload.user_id,
    nickname: payload.nickname,
    avatar_url: payload.avatar_url,
    headline: payload.headline,
    bio: payload.bio,
    prefecture: payload.prefecture,
    years_of_experience: payload.years_of_experience,
    experience_phases: payload.experience_phases,
    website_url: payload.website_url,
    role: payload.role,
    stats,
  };
}

export async function resolveViewer(
  supabase: SupabaseClient<Database>,
  authUserId: string | null,
): Promise<ViewerInfo> {
  if (!authUserId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", authUserId)
    .maybeSingle();
  if (!data) return null;
  return { user_id: data.user_id, role: data.role as UserRole };
}
