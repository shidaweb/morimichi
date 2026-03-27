"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateProfileNickname } from "@/lib/profile/update-profile-nickname";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateNicknameFromMyPage(formData: FormData) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    redirect(
      `/mypage?nick_error=${encodeURIComponent("サーバー設定の不備です。しばらくしてからお試しください。")}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/mypage");
  }

  const raw = formData.get("nickname");
  const nicknameRaw = raw == null ? "" : String(raw);

  const result = await updateProfileNickname(supabase, user, nicknameRaw);
  if (!result.ok) {
    redirect(`/mypage?nick_error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/mypage");
  redirect("/mypage?nick_ok=1");
}
