import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import type { Database } from "@/types/database";

const nicknameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(2, "ニックネームは2文字以上にしてください")
      .max(20, "ニックネームは20文字以内にしてください"),
  );

export type UpdateProfileNicknameResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateProfileNickname(
  supabase: SupabaseClient<Database>,
  user: User,
  nicknameRaw: string,
): Promise<UpdateProfileNicknameResult> {
  const parsed = nicknameSchema.safeParse(nicknameRaw);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "ニックネームの形式が正しくありません";
    return { ok: false, message: msg };
  }

  const nickname = parsed.data;

  let { data: existing } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr) {
      console.error("profile bootstrap before nickname:", bootErr);
      return { ok: false, message: "プロフィールを作成できませんでした" };
    }
    const { data: created } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", user.id)
      .maybeSingle();
    existing = created;
  }

  if (!existing) {
    return { ok: false, message: "プロフィールを読み込めませんでした" };
  }

  if (existing.nickname === nickname) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      nickname,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    const code = "code" in error ? String(error.code) : "";
    const msg = error.message?.toLowerCase() ?? "";
    const isUnique =
      code === "23505" || msg.includes("unique") || msg.includes("duplicate");
    if (isUnique) {
      return { ok: false, message: "このニックネームはすでに使われています" };
    }
    console.error(error);
    return { ok: false, message: "保存に失敗しました" };
  }

  return { ok: true };
}
