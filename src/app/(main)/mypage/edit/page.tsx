import Link from "next/link";

import { ProfileForm, type ProfileFormInitial } from "@/components/profile/profile-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function MyPageEditPage() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-muted-foreground text-sm">設定を確認してください。</p>
        <Link href="/login?next=/mypage/edit" className={cn(buttonVariants({ size: "sm" }), "inline-flex")}>
          ログインへ
        </Link>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-muted-foreground text-sm">ログインが必要です。</p>
        <Link href="/login?next=/mypage/edit" className={cn(buttonVariants({ size: "sm" }), "inline-flex")}>
          ログインへ
        </Link>
      </div>
    );
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select(
      "nickname, avatar_url, bio, headline, prefecture, years_of_experience, experience_phases, website_url, is_profile_public, role",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr === null) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select(
          "nickname, avatar_url, bio, headline, prefecture, years_of_experience, experience_phases, website_url, is_profile_public, role",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      profile = p2;
    }
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-muted-foreground text-sm">プロフィールを読み込めませんでした。</p>
      </div>
    );
  }

  const { data: phases } = await supabase
    .from("phases")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const initial: ProfileFormInitial = {
    nickname: profile.nickname,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    headline: profile.headline,
    prefecture: profile.prefecture,
    years_of_experience: profile.years_of_experience,
    experience_phases: profile.experience_phases,
    website_url: profile.website_url,
    is_profile_public: profile.is_profile_public,
    role: profile.role as UserRole,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">プロフィールを編集</h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          表示名・自己紹介・公開設定などをまとめて変更できます。
        </p>
      </div>
      <ProfileForm initial={initial} phases={phases ?? []} />
    </div>
  );
}
