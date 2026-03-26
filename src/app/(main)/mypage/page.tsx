import { redirect } from "next/navigation";

import { NotificationSettingsForm } from "@/components/mypage/NotificationSettingsForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MyPage() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "notification_on_reply, notification_on_reaction, notification_digest",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          アカウント設定と通知の受け取り方を変更できます。
        </p>
      </div>

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
