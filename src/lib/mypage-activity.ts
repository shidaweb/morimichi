import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActivityConsultationItem, ActivityReplyItem } from "@/components/profile/activity-history";
import type { Database } from "@/types/database";

function excerpt(text: string, max = 100) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export async function fetchMypageActivity(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ consultations: ActivityConsultationItem[]; replies: ActivityReplyItem[] }> {
  const [{ data: cons }, { data: reps }] = await Promise.all([
    supabase
      .from("consultations")
      .select("id, title, body, created_at, phase_id")
      .eq("user_id", userId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("replies")
      .select("id, body, created_at, consultation_id")
      .eq("user_id", userId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const phaseIds = new Set<string>();
  for (const c of cons ?? []) phaseIds.add(c.phase_id);
  const repConsultationIds = [...new Set((reps ?? []).map((r) => r.consultation_id))];
  let repConsultations: { id: string; title: string; phase_id: string }[] = [];
  if (repConsultationIds.length > 0) {
    const { data: rc } = await supabase
      .from("consultations")
      .select("id, title, phase_id")
      .in("id", repConsultationIds)
      .eq("status", "published");
    repConsultations = rc ?? [];
    for (const x of repConsultations) phaseIds.add(x.phase_id);
  }

  const phaseMap = new Map<string, { name: string; icon: string | null }>();
  if (phaseIds.size > 0) {
    const { data: phases } = await supabase
      .from("phases")
      .select("id, name, icon")
      .in("id", [...phaseIds]);
    for (const p of phases ?? []) {
      phaseMap.set(p.id, { name: p.name, icon: p.icon });
    }
  }

  const consultations: ActivityConsultationItem[] = (cons ?? []).map((c) => {
    const ph = phaseMap.get(c.phase_id);
    return {
      id: c.id,
      title: c.title,
      excerpt: excerpt(c.body),
      created_at: c.created_at,
      phase: ph ? { name: ph.name, icon: ph.icon } : null,
    };
  });

  const consTitleById = new Map(repConsultations.map((c) => [c.id, c]));

  const replies: ActivityReplyItem[] = (reps ?? []).map((r) => {
    const meta = consTitleById.get(r.consultation_id);
    const ph = meta ? phaseMap.get(meta.phase_id) : undefined;
    return {
      id: r.id,
      consultation_id: r.consultation_id,
      excerpt: excerpt(r.body),
      created_at: r.created_at,
      consultation_title: meta?.title ?? "（相談を読み込めませんでした）",
      phase: ph ? { name: ph.name, icon: ph.icon } : null,
    };
  });

  return { consultations, replies };
}
