import Link from "next/link";

import { AccountRoleSwitcher } from "@/components/mypage/AccountRoleSwitcher";
import { NicknameEditor } from "@/components/mypage/NicknameEditor";
import { NotificationSettingsForm } from "@/components/mypage/NotificationSettingsForm";
import { buttonVariants } from "@/components/ui/button-variants";
import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { canChangeRoleFrom } from "@/lib/profile/update-profile-role";
import { isProvisionalSystemNickname } from "@/lib/profile/provisional-nickname";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
      "nickname, role, notification_on_reply, notification_on_reaction, notification_digest",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr === null) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select(
          "nickname, role, notification_on_reply, notification_on_reaction, notification_digest",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      profile = p2;
    }
  }

  const rawNick = profile?.nickname?.trim() ?? "";
  const provisionalNick = isProvisionalSystemNickname(rawNick);
  const showEmptyInput = provisionalNick || !rawNick;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          アカウント設定と通知の受け取り方を変更できます。
        </p>
      </div>

      {!profile ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          プロフィールを読み込み中です。登録時のニックネームは、作成後に相談・返信の表示名として使われます。読み込みが終わらない場合は、下のフォームに表示名を入力して保存してください。
        </p>
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed">
          <strong className="font-medium text-foreground">登録時に入力したニックネーム</strong>
          が、相談の投稿・返信・スレッド上での表示名として使われます。表示を変えたいときは、下のフォームからいつでも更新できます（中身は同じ「ニックネーム」データです）。
        </p>
      )}
      <div className="border-border space-y-1 rounded-xl border bg-card/40 px-4 py-3">
        <p className="text-muted-foreground text-sm">いま表示に使っているニックネーム</p>
        {provisionalNick || !rawNick ? (
          <div className="space-y-1">
            <p className="text-base font-semibold tracking-tight">未登録（要設定）</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              登録フォームで決めた名前がまだ反映されていない場合があります。下のフォームに、相談・返信で使いたいニックネームを入力して保存してください。
            </p>
          </div>
        ) : (
          <p className="text-base font-semibold tracking-tight">{rawNick}</p>
        )}
      </div>

      <section
        className="border-border space-y-4 rounded-xl border p-6"
        aria-labelledby="mypage-nickname-change-heading"
      >
        <div>
          <h2
            id="mypage-nickname-change-heading"
            className="text-lg font-semibold tracking-tight"
          >
            ニックネームを変更する
          </h2>
          {provisionalNick || !rawNick ? (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              相談・返信に載せるニックネーム（2〜20文字）を入力して保存してください。メールアドレスが公開されることはありません。
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              登録時と同じ項目です。ここで保存した内容が、相談の投稿・返信などの表示名としてすぐに反映されます。変更したいときは下に入力して保存してください（2〜20文字）。メールアドレスは公開されません。
            </p>
          )}
        </div>

        <NicknameEditor
          key={`${user.id}|${provisionalNick ? "p" : "ok"}|${encodeURIComponent(rawNick)}`}
          initialNickname={profile?.nickname ?? ""}
          startWithEmptyInput={showEmptyInput}
        />
      </section>

      {profile && canChangeRoleFrom(profile.role) ? (
        <AccountRoleSwitcher currentRole={profile.role} />
      ) : null}

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
