import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type UserRole = Database["public"]["Tables"]["profiles"]["Row"]["role"];

export type ProfileBootstrapPayload = {
  nickname: string;
  role: UserRole;
  experience_phases: string[] | null;
};

function parseRole(meta: Record<string, unknown>): UserRole {
  const r = meta.role;
  if (r === "consulter" || r === "advisor" || r === "both") return r;
  return "consulter";
}

function parseExperiencePhases(
  meta: Record<string, unknown>,
  role: UserRole,
): string[] | null {
  if (role === "consulter") return null;
  const ep = meta.experience_phases;
  if (!Array.isArray(ep)) return null;
  const slugs = ep.filter((x): x is string => typeof x === "string");
  return slugs.length > 0 ? slugs : null;
}

function nicknameFromMetadata(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    meta.nickname,
    meta.display_name,
    meta.full_name,
    meta.name,
  ];
  for (const c of candidates) {
    if (typeof c === "string") {
      const t = c.trim();
      if (t.length >= 2 && t.length <= 20) return t;
      if (t.length > 20) return t.slice(0, 20);
    }
  }
  const digits = () =>
    Array.from({ length: 6 }, () => String(Math.floor(Math.random() * 10))).join("");
  return `利用者${digits()}`;
}

/** Build profile row from auth user_metadata (set at signUp via options.data). */
export function profilePayloadFromUser(user: User): ProfileBootstrapPayload {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const role = parseRole(meta);
  const nickname = nicknameFromMetadata(user);
  const experience_phases = parseExperiencePhases(meta, role);

  return { nickname, role, experience_phases };
}

/**
 * Ensures a single profiles row exists for the current auth user.
 * Returns whether a new row was inserted.
 */
export async function ensureProfileForUser(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<{ created: boolean; error: string | null }> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { created: false, error: null };
  }

  const base = profilePayloadFromUser(user);
  let nickname = base.nickname;

  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      nickname,
      role: base.role,
      experience_phases: base.experience_phases,
    });

    if (!error) {
      return { created: true, error: null };
    }

    const msg = error.message?.toLowerCase() ?? "";
    const isUnique =
      error.code === "23505" ||
      msg.includes("unique") ||
      msg.includes("duplicate");

    if (!isUnique) {
      return { created: false, error: error.message };
    }

    const suffix = attempt + 1;
    const maxBase = 20 - String(suffix).length - 1;
    nickname = `${base.nickname.slice(0, Math.max(2, maxBase))}_${suffix}`;
  }

  return { created: false, error: "nickname_conflict" };
}
