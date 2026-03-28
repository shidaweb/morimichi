import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type PublicProfileReplyRow = {
  id: string;
  body: string;
  created_at: string;
  consultation_id: string;
  consultation_title: string;
  phase: { name: string; icon: string | null } | null;
};

export async function fetchPublicProfileRecentReplies(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 5,
): Promise<PublicProfileReplyRow[]> {
  const { data: reps } = await supabase
    .from("replies")
    .select("id, body, created_at, consultation_id")
    .eq("user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  const list = reps ?? [];
  const cids = [...new Set(list.map((r) => r.consultation_id))];
  const consMap = new Map<string, { title: string; phase_id: string }>();
  if (cids.length > 0) {
    const { data: cons } = await supabase
      .from("consultations")
      .select("id, title, phase_id")
      .in("id", cids)
      .eq("status", "published");
    for (const c of cons ?? []) {
      consMap.set(c.id, { title: c.title, phase_id: c.phase_id });
    }
  }

  const phaseIds = [...new Set([...consMap.values()].map((c) => c.phase_id))];
  const phaseMap = new Map<string, { name: string; icon: string | null }>();
  if (phaseIds.length > 0) {
    const { data: phases } = await supabase
      .from("phases")
      .select("id, name, icon")
      .in("id", phaseIds);
    for (const p of phases ?? []) {
      phaseMap.set(p.id, { name: p.name, icon: p.icon });
    }
  }

  return list.map((r) => {
    const c = consMap.get(r.consultation_id);
    const ph = c ? phaseMap.get(c.phase_id) : undefined;
    return {
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      consultation_id: r.consultation_id,
      consultation_title: c?.title ?? "",
      phase: ph ? { name: ph.name, icon: ph.icon } : null,
    };
  });
}
