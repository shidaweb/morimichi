import Link from "next/link";

import { NicknameForm } from "@/components/mypage/NicknameForm";
import { NotificationSettingsForm } from "@/components/mypage/NotificationSettingsForm";
import { buttonVariants } from "@/components/ui/button-variants";
import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <p className="text-muted-foreground text-sm">
          ログインすると通知設定を変更できます。
        </p>
        <Link
          href="/login?next=/mypage"
          className={cn(buttonVariants({ size: "sm" }), "inline-flex")}
        >
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
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <p className="text-muted-foreground text-sm">
          ログインすると通知設定を変更できます。
        </p>
        <Link
          href="/login?next=/mypage"
          className={cn(buttonVariants({ size: "sm" }), "inline-flex")}
        >
          ログインへ
        </Link>
      </div>
    );
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select(
      "nickname, notification_on_reply, notification_on_reaction, notification_digest",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr === null) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select(
          "nickname, notification_on_reply, notification_on_reaction, notification_digest",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      profile = p2;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          アカウント設定と通知の受け取り方を変更できます。
        </p>
      </div>

      {!profile ? (
        <p className="text-muted-foreground text-xs">
          プロフィール情報をまだ読み込めていません。ニックネームを入力して保存すると表示名が登録されます。
        </p>
      ) : null}
      <div className="border-border space-y-1 rounded-xl border bg-card/40 px-4 py-3">
        <p className="text-muted-foreground text-sm">今のニックネーム</p>
        <p className="text-base font-semibold tracking-tight">
          {profile?.nickname?.trim() ? profile.nickname : "未設定"}
        </p>
      </div>
      <NicknameForm
        key={profile?.nickname ?? "new"}
        initialNickname={profile?.nickname ?? ""}
      />

      <NotificationSettingsForm
        initial={{
          notificationOnReply: profile?.notification_on_reply ?? true,
          notificationOnReaction: profile?.notification_on_reaction ?? false,
          notificationDigest: profile?.notification_digest ?? true,
        }}
      />
    </div>
  );
}
