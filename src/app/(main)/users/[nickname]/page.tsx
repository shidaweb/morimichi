import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityStats } from "@/components/profile/activity-stats";
import { PublicProfileContact } from "@/components/profile/public-profile-contact";
import { Badge } from "@/components/ui/badge";
import { CertifiedProBadge } from "@/components/ui/certified-pro-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { UserAvatar } from "@/components/ui/user-avatar";
import { fetchPublicProfileRecentReplies } from "@/lib/profile/public-profile-replies";
import {
  getPublicProfileWithUserId,
  resolveViewer,
} from "@/lib/profile/public-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

type Props = { params: Promise<{ nickname: string }> };

function roleLabel(role: UserRole): string {
  switch (role) {
    case "advisor":
      return "回答者";
    case "both":
      return "相談・回答";
    case "moderator":
      return "モデレーター";
    case "admin":
      return "管理者";
    default:
      return "利用者";
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nickname: raw } = await params;
  const nickname = decodeURIComponent(raw).trim();
  return {
    title: `${nickname} さんのプロフィール`,
    description: `もりみちの公開プロフィール（${nickname}）`,
  };
}

export default async function PublicUserProfilePage({ params }: Props) {
  const { nickname: raw } = await params;
  const nickname = decodeURIComponent(raw).trim();
  if (!nickname) notFound();

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewer = await resolveViewer(supabase, user?.id ?? null);

  const full = await getPublicProfileWithUserId(supabase, nickname, viewer);
  if (!full) notFound();

  const { user_id, ...profile } = full;

  const slugs = profile.experience_phases ?? [];
  let experiencePhaseBadges: { name: string; icon: string | null }[] = [];
  if (slugs.length > 0) {
    const { data: phRows } = await supabase
      .from("phases")
      .select("slug, name, icon")
      .in("slug", slugs);
    experiencePhaseBadges = (phRows ?? []).map((p) => ({ name: p.name, icon: p.icon }));
  }

  const recent = await fetchPublicProfileRecentReplies(supabase, user_id, 5);

  const { data: pubArticles } = await supabase
    .from("articles")
    .select("id, title, published_at")
    .eq("author_user_id", user_id)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(8);

  const showContact =
    Boolean(user && user.id !== user_id && profile.is_certified_pro);

  const memberDate = new Date(profile.stats.member_since).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="border-border flex flex-col gap-6 rounded-xl border bg-card/40 p-6 sm:flex-row sm:items-start">
        <UserAvatar
          avatarUrl={profile.avatar_url}
          nickname={profile.nickname}
          size="xl"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{profile.nickname}</h1>
          {profile.is_certified_pro ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CertifiedProBadge specialty={profile.pro_specialty} size="lg" />
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                公認再生プロは運営が独自に認定するものであり、国家資格などの証明ではありません。
              </p>
            </>
          ) : null}
          {profile.headline ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{profile.headline}</p>
          ) : null}
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {profile.prefecture ? <span>{profile.prefecture}</span> : null}
            {profile.prefecture && profile.years_of_experience != null ? <span>・</span> : null}
            {profile.years_of_experience != null ? (
              <span>経験{profile.years_of_experience}年</span>
            ) : null}
            <span>・</span>
            <span>{roleLabel(profile.role)}</span>
            <span>・</span>
            <span>{memberDate}から参加</span>
          </p>
          {profile.website_url ? (
            <p className="pt-1">
              <a
                href={profile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm underline-offset-4 hover:underline"
              >
                ウェブサイト / SNS
              </a>
            </p>
          ) : null}
        </div>
      </section>

      {profile.bio ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">自己紹介</h2>
          <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {profile.bio}
          </p>
        </section>
      ) : null}

      {experiencePhaseBadges.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">経験フェーズ</h2>
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

      {(pubArticles ?? []).length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">コラム</h2>
          <ul className="space-y-2 text-sm">
            {(pubArticles ?? []).map((a) => (
              <li key={a.id}>
                <Link href={`/articles/${a.id}`} className="text-primary hover:underline">
                  {a.title}
                </Link>
                {a.published_at ? (
                  <span className="text-muted-foreground ml-2 text-xs">
                    {new Date(a.published_at).toLocaleDateString("ja-JP")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PublicProfileContact
        targetNickname={profile.nickname}
        targetAvatarUrl={profile.avatar_url}
        proSpecialty={profile.pro_specialty}
        show={showContact}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">活動実績</h2>
        <ActivityStats
          totalConsultations={profile.stats.total_consultations}
          totalReplies={profile.stats.total_replies}
          totalReactionsReceived={profile.stats.total_reactions_received}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">この方の回答</h2>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">まだ表示できる回答がありません。</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/consultations/${r.consultation_id}`}
                  className="border-border hover:border-primary/40 block rounded-lg border bg-card/40 p-3 transition-colors"
                >
                  <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-2 text-xs">
                    {r.phase ? (
                      <span>
                        <span className="mr-0.5">{r.phase.icon}</span>
                        {r.phase.name}
                      </span>
                    ) : null}
                    <time dateTime={r.created_at}>
                      {new Date(r.created_at).toLocaleDateString("ja-JP", { dateStyle: "medium" })}
                    </time>
                  </div>
                  <p className="font-medium leading-snug">{r.consultation_title}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                    {r.body.replace(/\s+/g, " ").trim().slice(0, 120)}
                    {r.body.length > 120 ? "…" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/consultations" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}>
        相談一覧へ
      </Link>
    </div>
  );
}
