import { ConsultationCard } from "@/components/consultation/ConsultationCard";
import {
  fetchProSpecialtyBadgeMap,
  resolveProBadge,
} from "@/lib/pro/pro-specialty-badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ConsultationAuthorSummary, ConsultationListItem } from "@/types/consultations";
import type { UserRole } from "@/types/database";

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

    const authorUserIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    type RawAuthor = {
      nickname: string;
      avatar_url: string | null;
      is_profile_public: boolean;
      role: UserRole;
      is_certified_pro: boolean;
      pro_specialty: string | null;
    };
    const authorByUserId = new Map<string, RawAuthor>();
    if (authorUserIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select(
          "user_id, nickname, avatar_url, is_profile_public, role, is_certified_pro, pro_specialty",
        )
        .in("user_id", authorUserIds);
      for (const p of profs ?? []) {
        authorByUserId.set(p.user_id, {
          nickname: p.nickname,
          avatar_url: p.avatar_url,
          is_profile_public: p.is_profile_public,
          role: p.role as UserRole,
          is_certified_pro: Boolean(p.is_certified_pro),
          pro_specialty: p.pro_specialty ?? null,
        });
      }
    }

    const badgeMap = await fetchProSpecialtyBadgeMap(
      supabase,
      [...authorByUserId.values()].map((a) => a.pro_specialty),
    );

    const items: ConsultationListItem[] = rows.map((r) => {
      const ap = r.user_id ? authorByUserId.get(r.user_id) : undefined;
      const isCertified = Boolean(ap?.is_certified_pro);
      const pro_specialty = ap
        ? resolveProBadge(isCertified, ap.pro_specialty, badgeMap)
        : null;
      return {
        ...r,
        phase: phaseMap.get(r.phase_id) ?? null,
        author: ap
          ? {
              nickname: ap.nickname,
              avatar_url: ap.avatar_url,
              is_profile_public: ap.is_profile_public,
              role: ap.role,
              is_certified_pro: isCertified,
              pro_specialty,
            }
          : null,
      };
    });

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
