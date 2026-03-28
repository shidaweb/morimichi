import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import type { Database } from "@/types/database";

export type SwitchableUserRole = "consulter" | "advisor" | "both";

/** マイページで「片方」から切り替え可能なロール（both は UI に出さない） */
export type ExclusiveAccountRole = "consulter" | "advisor";

type UserRole = Database["public"]["Tables"]["profiles"]["Row"]["role"];

export type UpdateProfileRoleResult =
  | { ok: true }
  | { ok: false; message: string };

function isSwitchableRole(r: UserRole): r is SwitchableUserRole {
  return r === "consulter" || r === "advisor" || r === "both";
}

function isAllowedTarget(r: unknown): r is SwitchableUserRole {
  return r === "consulter" || r === "advisor" || r === "both";
}

/** 相談のみ／回答のみのときマイページで変更 UI を出す。both・モデレーター等では不可。 */
export function canChangeRoleFrom(current: UserRole): current is ExclusiveAccountRole {
  return current === "consulter" || current === "advisor";
}

export async function updateProfileRole(
  supabase: SupabaseClient<Database>,
  user: User,
  nextRoleRaw: unknown,
): Promise<UpdateProfileRoleResult> {
  if (!isAllowedTarget(nextRoleRaw)) {
    return { ok: false, message: "指定したアカウント種別は変更できません" };
  }
  const nextRole = nextRoleRaw;

  let { data: row } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr) {
      console.error("profile bootstrap before role:", bootErr);
      return { ok: false, message: "プロフィールを作成できませんでした" };
    }
    const { data: again } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    row = again;
  }

  if (!row) {
    return { ok: false, message: "プロフィールを読み込めませんでした" };
  }

  const current = row.role;
  if (!isSwitchableRole(current)) {
    return { ok: false, message: "このアカウント種別はここから変更できません" };
  }
  if (current === "both") {
    return { ok: false, message: "相談・回答両方のアカウントからは種別を変更できません" };
  }

  if (current === nextRole) {
    return { ok: true };
  }

  const patch: {
    role: SwitchableUserRole;
    experience_phases?: string[] | null;
    updated_at: string;
  } = {
    role: nextRole,
    updated_at: new Date().toISOString(),
  };

  if (nextRole === "consulter") {
    patch.experience_phases = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return { ok: false, message: "保存に失敗しました" };
  }

  return { ok: true };
}
