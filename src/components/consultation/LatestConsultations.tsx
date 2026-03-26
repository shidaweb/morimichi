import { ConsultationCard } from "@/components/consultation/ConsultationCard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ConsultationListItem } from "@/types/consultations";

export async function LatestConsultations() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: rows, error } = await supabase.rpc("fetch_consultations", {
      p_phase_id: null,
      p_sort: "new",
      p_limit: 3,
      p_after_created_at: null,
      p_after_id: null,
      p_after_reply_count: null,
      p_after_view_count: null,
    });

    if (error || !rows?.length) {
      return (
        <p className="text-muted-foreground text-sm leading-relaxed">
          まだ相談がありません。最初の投稿を待っています。
        </p>
      );
    }

    const phaseIds = [...new Set(rows.map((r) => r.phase_id))];
    const { data: phases } = await supabase
      .from("phases")
      .select("id,name,slug,icon")
      .in("id", phaseIds);

    const phaseMap = new Map(
      (phases ?? []).map((p) => [
        p.id,
        { name: p.name, slug: p.slug, icon: p.icon },
      ]),
    );

    const items: ConsultationListItem[] = rows.map((r) => ({
      ...r,
      phase: phaseMap.get(r.phase_id) ?? null,
    }));

    return (
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <ConsultationCard item={item} />
          </li>
        ))}
      </ul>
    );
  } catch {
    return (
      <p className="text-muted-foreground text-sm">
        相談の読み込みに失敗しました。しばらくしてからお試しください。
      </p>
    );
  }
}
