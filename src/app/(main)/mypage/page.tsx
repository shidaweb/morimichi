import Link from "next/link";

import { AccountRoleSwitcher } from "@/components/mypage/AccountRoleSwitcher";
import { NotificationSettingsForm } from "@/components/mypage/NotificationSettingsForm";
import { ActivityHistory } from "@/components/profile/activity-history";
import { ActivityStats } from "@/components/profile/activity-stats";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { canChangeRoleFrom } from "@/lib/profile/update-profile-role";
import { fetchProfileStats } from "@/lib/profile/public-profile";
import { fetchMypageActivity } from "@/lib/mypage-activity";
import { isProvisionalSystemNickname } from "@/lib/profile/provisional-nickname";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function roleLabel(role: UserRole): string {
  switch (role) {
    case "consulter":
      return "相談者";
    case "advisor":
      return "回答者";
    case "both":
      return "相談・回答";
    case "moderator":
      return "モデレーター";
    case "admin":
      return "管理者";
    default:
      return role;
  }
}

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
        <Link href="/login?next=/mypage" className={cn(buttonVariants({ size: "sm" }), "inline-flex")}>
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
        <Link href="/login?next=/mypage" className={cn(buttonVariants({ size: "sm" }), "inline-flex")}>
          ログインへ
        </Link>
      </div>
    );
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select(
      "nickname, role, avatar_url, headline, bio, prefecture, years_of_experience, experience_phases, is_profile_public, website_url, notification_on_reply, notification_on_reaction, notification_digest, created_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr === null) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select(
          "nickname, role, avatar_url, headline, bio, prefecture, years_of_experience, experience_phases, is_profile_public, website_url, notification_on_reply, notification_on_reaction, notification_digest, created_at",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      profile = p2;
    }
  }

  const rawNick = profile?.nickname?.trim() ?? "";
  const provisionalNick = isProvisionalSystemNickname(rawNick);

  const phaseSlugSet = new Set(profile?.experience_phases ?? []);
  let experiencePhaseBadges: { name: string; icon: string | null }[] = [];
  if (phaseSlugSet.size > 0) {
    const { data: phRows } = await supabase
      .from("phases")
      .select("slug, name, icon")
      .in("slug", [...phaseSlugSet]);
    experiencePhaseBadges = (phRows ?? []).map((p) => ({ name: p.name, icon: p.icon }));
  }

  const stats = profile
    ? await fetchProfileStats(supabase, user.id, profile.created_at)
    : null;

  const activity = profile ? await fetchMypageActivity(supabase, user.id) : { consultations: [], replies: [] };

  const role = (profile?.role ?? "consulter") as UserRole;
  const showPublicProfileLink =
    profile &&
    profile.is_profile_public &&
    role !== "consulter" &&
    !provisionalNick &&
    rawNick;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          プロフィール・活動の概要・通知やアカウント種別の設定ができます。
        </p>
      </div>

      {!profile ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          プロフィールを読み込み中です。しばらく待ってから再読み込みしてください。
        </p>
      ) : null}

      {profile ? (
        <>
          <section className="border-border flex flex-col gap-6 rounded-xl border bg-card/40 p-6 sm:flex-row sm:items-start">
            <UserAvatar
              avatarUrl={profile.avatar_url}
              nickname={rawNick || "未設定"}
              size="xl"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {provisionalNick || !rawNick ? "ニックネーム未設定" : rawNick}
                </h2>
                {profile.headline ? (
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{profile.headline}</p>
                ) : null}
                <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span>{roleLabel(role)}</span>
                  {profile.prefecture ? (
                    <>
                      <span aria-hidden>・</span>
                      <span>{profile.prefecture}</span>
                    </>
                  ) : null}
                  {profile.years_of_experience != null ? (
                    <>
                      <span aria-hidden>・</span>
                      <span>経験{profile.years_of_experience}年</span>
                    </>
                  ) : null}
                  {profile.is_profile_public && role !== "consulter" ? (
                    <Badge variant="secondary" className="ml-0 font-normal">
                      公開プロフィール
                    </Badge>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/mypage/edit"
                  className={cn(buttonVariants({ size: "sm" }), "inline-flex")}
                >
                  プロフィールを編集
                </Link>
                {showPublicProfileLink ? (
                  <Link
                    href={`/users/${encodeURIComponent(rawNick)}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
                    prefetch={false}
                  >
                    公開プロフィールを見る
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          {provisionalNick || !rawNick ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              相談・回答に表示するニックネームが未設定の可能性があります。
              <Link href="/mypage/edit" className="text-primary ml-1 underline-offset-4 hover:underline">
                プロフィール編集
              </Link>
              から設定してください。
            </p>
          ) : null}

          {profile.bio ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold tracking-tight">自己紹介</h3>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {profile.bio}
              </p>
            </section>
          ) : null}

          {experiencePhaseBadges.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold tracking-tight">経験フェーズ</h3>
              <div className="flex flex-wrap gap-2">
                {experiencePhaseBadges.map((p) => (
                  <Badge key={p.name} variant="secondary" className="font-normal">
                    {p.icon ? <span className="mr-1">{p.icon}</span> : null}
                    {p.name}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {profile.website_url ? (
            <p className="text-sm">
              <a
                href={profile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                ウェブサイト / SNS
              </a>
            </p>
          ) : null}

          {stats ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight">活動サマリー</h3>
              <ActivityStats
                totalConsultations={stats.total_consultations}
                totalReplies={stats.total_replies}
                totalReactionsReceived={stats.total_reactions_received}
              />
            </section>
          ) : null}

          <ActivityHistory consultations={activity.consultations} replies={activity.replies} />

          <section className="border-border space-y-3 rounded-xl border p-6">
            <h3 className="text-sm font-semibold tracking-tight">設定</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <span className="text-foreground font-medium">通知</span> — 下のフォームから変更できます
              </li>
              {(role === "consulter" || role === "advisor") && (
                <li>
                  <span className="text-foreground font-medium">アカウントの種類</span> — 下のブロックから変更できます
                </li>
              )}
              <li>
                <Link href="/withdrawal" className="text-primary underline-offset-4 hover:underline">
                  退会手続きへ
                </Link>
              </li>
            </ul>
          </section>
        </>
      ) : null}

      {profile && canChangeRoleFrom(profile.role as UserRole) ? (
        <AccountRoleSwitcher currentRole={profile.role as "consulter" | "advisor"} />
      ) : null}

      {profile ? (
        <NotificationSettingsForm
          initial={{
            notificationOnReply: profile.notification_on_reply ?? true,
            notificationOnReaction: profile.notification_on_reaction ?? false,
            notificationDigest: profile.notification_digest ?? true,
          }}
        />
      ) : null}
    </div>
  );
}
