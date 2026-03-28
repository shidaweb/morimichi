import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

import { PREFECTURES } from "@/lib/constants/prefectures";
import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { updateProfileNickname } from "@/lib/profile/update-profile-nickname";
import type { Database, UserRole } from "@/types/database";

export const profileMePatchSchema = z
  .object({
    nickname: z.string().trim().min(2).max(20).optional(),
    bio: z.string().max(500).nullable().optional(),
    experience_phases: z.array(z.string().max(64)).max(32).nullable().optional(),
    notification_on_reply: z.boolean().optional(),
    notification_on_reaction: z.boolean().optional(),
    notification_digest: z.boolean().optional(),
    headline: z.string().max(60).nullable().optional(),
    prefecture: z.string().max(10).nullable().optional(),
    years_of_experience: z
      .number()
      .int()
      .min(0)
      .max(99)
      .nullable()
      .optional(),
    is_profile_public: z.boolean().optional(),
    website_url: z.string().max(500).nullable().optional(),
  })
  .strict();

export type ProfileMePatchInput = z.infer<typeof profileMePatchSchema>;

export type UpdateProfileMeResult =
  | { ok: true }
  | { ok: false; message: string; field?: string };

function canHaveAdvisorFields(role: UserRole): boolean {
  return role === "advisor" || role === "both" || role === "moderator" || role === "admin";
}

function normalizeWebsiteUrl(raw: string | null | undefined): string | null | "invalid" {
  if (raw == null || raw.trim() === "") return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return "invalid";
    return u.toString();
  } catch {
    return "invalid";
  }
}

export async function updateProfileMe(
  supabase: SupabaseClient<Database>,
  user: User,
  body: unknown,
): Promise<UpdateProfileMeResult> {
  const parsed = profileMePatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return { ok: false, message: msg, field: String(parsed.error.issues[0]?.path[0] ?? "") };
  }

  const data = parsed.data;

  let { data: row } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr) {
      return { ok: false, message: "プロフィールを作成できませんでした" };
    }
    const { data: again } = await supabase
      .from("profiles")
      .select("role, nickname")
      .eq("user_id", user.id)
      .maybeSingle();
    row = again;
  }

  if (!row) {
    return { ok: false, message: "プロフィールを読み込めませんでした" };
  }

  const role = row.role as UserRole;
  const advisorish = canHaveAdvisorFields(role);

  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (data.nickname !== undefined) {
    const nickRes = await updateProfileNickname(supabase, user, data.nickname);
    if (!nickRes.ok) {
      return { ok: false, message: nickRes.message, field: "nickname" };
    }
  }

  if (data.bio !== undefined) {
    patch.bio = data.bio === null || data.bio === "" ? null : data.bio;
  }

  if (data.experience_phases !== undefined) {
    if (!advisorish) {
      patch.experience_phases = null;
    } else {
      patch.experience_phases =
        data.experience_phases === null || data.experience_phases.length === 0
          ? null
          : data.experience_phases;
    }
  }

  if (data.notification_on_reply !== undefined) {
    patch.notification_on_reply = data.notification_on_reply;
  }
  if (data.notification_on_reaction !== undefined) {
    patch.notification_on_reaction = data.notification_on_reaction;
  }
  if (data.notification_digest !== undefined) {
    patch.notification_digest = data.notification_digest;
  }

  if (data.headline !== undefined) {
    patch.headline =
      data.headline === null || data.headline.trim() === "" ? null : data.headline.trim();
  }

  if (data.prefecture !== undefined) {
    if (data.prefecture === null || data.prefecture === "") {
      patch.prefecture = null;
    } else if (!(PREFECTURES as readonly string[]).includes(data.prefecture)) {
      return { ok: false, message: "都道府県の値が正しくありません", field: "prefecture" };
    } else {
      patch.prefecture = data.prefecture;
    }
  }

  if (data.years_of_experience !== undefined) {
    patch.years_of_experience = data.years_of_experience;
  }

  if (data.is_profile_public !== undefined) {
    patch.is_profile_public = advisorish ? data.is_profile_public : false;
  }

  if (data.website_url !== undefined) {
    const w = normalizeWebsiteUrl(data.website_url ?? null);
    if (w === "invalid") {
      return { ok: false, message: "URL は http(s) で始まる形式にしてください", field: "website_url" };
    }
    patch.website_url = w;
  }

  const keys = Object.keys(patch).filter((k) => k !== "updated_at");
  if (keys.length === 0) {
    return { ok: true };
  }

  const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);

  if (error) {
    console.error(error);
    return { ok: false, message: "保存に失敗しました" };
  }

  return { ok: true };
}
