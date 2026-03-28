import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ProSpecialty } from "@/types/database";

export type ProSpecialtyBadge = {
  slug: string;
  name: string;
  icon: string | null;
};

export async function fetchProSpecialtyBadgeMap(
  supabase: SupabaseClient<Database>,
  slugs: (ProSpecialty | string | null | undefined)[],
): Promise<Map<string, ProSpecialtyBadge>> {
  const unique = [...new Set(slugs.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("pro_specialties")
    .select("slug, name, icon")
    .in("slug", unique);
  const m = new Map<string, ProSpecialtyBadge>();
  for (const s of data ?? []) {
    m.set(s.slug, { slug: s.slug, name: s.name, icon: s.icon });
  }
  return m;
}

export function resolveProBadge(
  isCertified: boolean,
  specialtySlug: ProSpecialty | string | null | undefined,
  badgeMap: Map<string, ProSpecialtyBadge>,
): ProSpecialtyBadge | null {
  if (!isCertified || !specialtySlug) return null;
  return (
    badgeMap.get(specialtySlug) ?? {
      slug: specialtySlug,
      name: specialtySlug,
      icon: null,
    }
  );
}
