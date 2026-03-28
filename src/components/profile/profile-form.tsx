"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AvatarUpload } from "@/components/profile/avatar-upload";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button-variants";
import { PREFECTURES } from "@/lib/constants/prefectures";
import { cn } from "@/lib/utils";
import type { Database, UserRole } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];

export type ProfileFormInitial = {
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  headline: string | null;
  prefecture: string | null;
  years_of_experience: number | null;
  experience_phases: string[] | null;
  website_url: string | null;
  is_profile_public: boolean;
  role: UserRole;
};

type Props = {
  initial: ProfileFormInitial;
  phases: PhaseRow[];
};

function advisorishRole(role: UserRole): boolean {
  return role === "advisor" || role === "both" || role === "moderator" || role === "admin";
}

export function ProfileForm({ initial, phases }: Props) {
  const router = useRouter();
  const showAdvisorFields = advisorishRole(initial.role);

  const [nickname, setNickname] = useState(initial.nickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatar_url);
  const [headline, setHeadline] = useState(initial.headline ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [prefecture, setPrefecture] = useState(initial.prefecture ?? "");
  const [years, setYears] = useState(
    initial.years_of_experience != null ? String(initial.years_of_experience) : "",
  );
  const [experiencePhases, setExperiencePhases] = useState<string[]>(
    initial.experience_phases ?? [],
  );
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url ?? "");
  const [isPublic, setIsPublic] = useState(initial.is_profile_public);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePhase = useCallback((slug: string) => {
    setExperiencePhases((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return [...next];
    });
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPending(true);
      setMessage(null);
      setError(null);

      const nick = nickname.trim();
      if (nick.length < 2 || nick.length > 20) {
        setError("ニックネームは2〜20文字にしてください");
        setPending(false);
        return;
      }
      if (headline.length > 60) {
        setError("肩書きは60文字以内にしてください");
        setPending(false);
        return;
      }
      if (bio.length > 500) {
        setError("自己紹介は500文字以内にしてください");
        setPending(false);
        return;
      }

      let yearsNum: number | null = null;
      if (years.trim() !== "") {
        const n = Number(years);
        if (!Number.isInteger(n) || n < 0 || n > 99) {
          setError("経営経験年数は0〜99の整数で入力してください");
          setPending(false);
          return;
        }
        yearsNum = n;
      }

      const body: Record<string, unknown> = {
        nickname: nick,
        bio: bio.trim() === "" ? null : bio,
        headline: headline.trim() === "" ? null : headline.trim(),
        prefecture: prefecture === "" ? null : prefecture,
        years_of_experience: yearsNum,
        website_url: websiteUrl.trim() === "" ? null : websiteUrl.trim(),
        is_profile_public: showAdvisorFields ? isPublic : false,
        experience_phases: showAdvisorFields ? experiencePhases : null,
      };

      try {
        const res = await fetch("/api/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          setError(typeof data.message === "string" ? data.message : "保存に失敗しました");
          setPending(false);
          return;
        }
        setMessage("保存しました");
        router.refresh();
      } catch {
        setError("通信エラーが発生しました");
      }
      setPending(false);
    },
    [
      nickname,
      bio,
      headline,
      prefecture,
      years,
      websiteUrl,
      isPublic,
      experiencePhases,
      showAdvisorFields,
      router,
    ],
  );

  return (
    <form className="space-y-8" onSubmit={(ev) => void onSubmit(ev)}>
      <Link href="/mypage" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex px-0")}>
        ← マイページに戻る
      </Link>

      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="border-border space-y-4 rounded-xl border p-6">
        <h2 className="text-lg font-semibold tracking-tight">プロフィール画像</h2>
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          nickname={nickname.trim() || initial.nickname}
          onUploadSuccess={(url) => {
            setAvatarUrl(url);
            setMessage("画像を更新しました");
            router.refresh();
          }}
          onDeleteSuccess={() => {
            setAvatarUrl(null);
            setMessage("画像を削除しました");
            router.refresh();
          }}
        />
      </section>

      <section className="border-border space-y-4 rounded-xl border p-6">
        <h2 className="text-lg font-semibold tracking-tight">基本情報</h2>

        <div className="space-y-2">
          <Label htmlFor="pf-nick">ニックネーム（2〜20文字）</Label>
          <Input
            id="pf-nick"
            value={nickname}
            onChange={(ev) => setNickname(ev.target.value)}
            maxLength={20}
            autoComplete="nickname"
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pf-headline">肩書き・ひとこと（60文字以内）</Label>
          <Input
            id="pf-headline"
            value={headline}
            onChange={(ev) => setHeadline(ev.target.value)}
            maxLength={60}
            disabled={pending}
            placeholder="例: 元飲食店経営者。再起の経験があります"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pf-bio">自己紹介（500文字以内）</Label>
          <Textarea
            id="pf-bio"
            value={bio}
            onChange={(ev) => setBio(ev.target.value)}
            maxLength={500}
            rows={6}
            disabled={pending}
            className="min-h-[120px] resize-y"
          />
          <p className="text-muted-foreground text-xs">{bio.length}/500</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pf-pref">都道府県（任意）</Label>
          <select
            id="pf-pref"
            value={prefecture}
            onChange={(ev) => setPrefecture(ev.target.value)}
            disabled={pending}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full max-w-xs rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">未設定</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pf-years">経営経験年数（任意）</Label>
          <div className="flex max-w-[10rem] items-center gap-2">
            <Input
              id="pf-years"
              type="number"
              min={0}
              max={99}
              value={years}
              onChange={(ev) => setYears(ev.target.value)}
              disabled={pending}
            />
            <span className="text-muted-foreground text-sm">年</span>
          </div>
        </div>

        {showAdvisorFields ? (
          <div className="space-y-2">
            <Label>経験したことのあるフェーズ（複数可）</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {phases.map((p) => (
                <label
                  key={p.id}
                  className="border-border flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"
                >
                  <Checkbox
                    checked={experiencePhases.includes(p.slug)}
                    onCheckedChange={() => togglePhase(p.slug)}
                    disabled={pending}
                  />
                  <span>
                    <span className="mr-1">{p.icon}</span>
                    {p.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="pf-web">ウェブサイト / SNS（http(s) の URL、任意）</Label>
          <Input
            id="pf-web"
            type="url"
            value={websiteUrl}
            onChange={(ev) => setWebsiteUrl(ev.target.value)}
            disabled={pending}
            placeholder="https://"
            autoComplete="url"
          />
        </div>

        {showAdvisorFields ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-dashed p-4">
            <Checkbox
              checked={isPublic}
              onCheckedChange={(v) => setIsPublic(v === true)}
              disabled={pending}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium">プロフィールを公開する</span>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                他の利用者が「/users/ニックネーム」からあなたのプロフィールを閲覧できるようになります。
              </p>
            </div>
          </label>
        ) : null}
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "保存中…" : "保存する"}
      </Button>
    </form>
  );
}
