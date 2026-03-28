import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { ConsultationReactionsSummary, ReplyPublic } from "@/types/replies";

export async function fetchConsultationRepliesData(
  supabase: SupabaseClient<Database>,
  consultationId: string,
): Promise<
  | { ok: true; replies: ReplyPublic[]; consultationReaction: ConsultationReactionsSummary }
  | { ok: false; error: "not_found" | "fetch_failed" }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: consultation, error: cErr } = await supabase
    .from("consultations")
    .select("id, status, reaction_count")
    .eq("id", consultationId)
    .maybeSingle();

  if (cErr || !consultation || consultation.status !== "published") {
    return { ok: false, error: "not_found" };
  }

  const { data: replyRows, error: rErr } = await supabase
    .from("replies")
    .select("*")
    .eq("consultation_id", consultationId)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (rErr) {
    console.error(rErr);
    return { ok: false, error: "fetch_failed" };
  }

  const replies = replyRows ?? [];
  const userIds = [
    ...new Set(replies.map((r) => r.user_id).filter(Boolean)),
  ] as string[];

  type AuthorRow = {
    user_id: string;
    nickname: string;
    avatar_url: string | null;
    is_profile_public: boolean;
    role: string;
  };
  const authorMap = new Map<string, AuthorRow>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url, is_profile_public, role")
      .in("user_id", userIds);
    for (const p of profiles ?? []) {
      authorMap.set(p.user_id, p as AuthorRow);
    }
  }

  const replyIds = replies.map((r) => r.id);
  const empathyByReply = new Map<string, number>();
  if (replyIds.length > 0) {
    const { data: reactRows } = await supabase
      .from("reactions")
      .select("target_id, user_id")
      .eq("target_type", "reply")
      .in("target_id", replyIds)
      .eq("reaction_type", "empathy");

    for (const row of reactRows ?? []) {
      const k = row.target_id;
      empathyByReply.set(k, (empathyByReply.get(k) ?? 0) + 1);
    }
  }

  const myReplyEmpathy = new Set<string>();
  if (user && replyIds.length > 0) {
    const { data: mine } = await supabase
      .from("reactions")
      .select("target_id")
      .eq("target_type", "reply")
      .in("target_id", replyIds)
      .eq("reaction_type", "empathy")
      .eq("user_id", user.id);
    for (const m of mine ?? []) myReplyEmpathy.add(m.target_id);
  }

  let hasMyConsultationEmpathy = false;
  if (user) {
    const { data: cm } = await supabase
      .from("reactions")
      .select("id")
      .eq("target_type", "consultation")
      .eq("target_id", consultationId)
      .eq("reaction_type", "empathy")
      .eq("user_id", user.id)
      .maybeSingle();
    hasMyConsultationEmpathy = Boolean(cm);
  }

  const consultationReaction: ConsultationReactionsSummary = {
    empathyCount: consultation.reaction_count ?? 0,
    hasMyEmpathy: hasMyConsultationEmpathy,
  };

  const payload: ReplyPublic[] = replies.map((r) => {
    const author = r.user_id ? authorMap.get(r.user_id) : undefined;
    return {
      id: r.id,
      consultation_id: r.consultation_id,
      parent_reply_id: r.parent_reply_id,
      body: r.body,
      depth: r.depth,
      created_at: r.created_at,
      nickname: author?.nickname ?? null,
      avatar_url: author?.avatar_url ?? null,
      profile_public: author?.is_profile_public ?? false,
      author_role: (author?.role as ReplyPublic["author_role"]) ?? null,
      empathyCount: empathyByReply.get(r.id) ?? 0,
      hasMyEmpathy: myReplyEmpathy.has(r.id),
    };
  });

  return { ok: true, replies: payload, consultationReaction };
}
