"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { CertifiedProBadge } from "@/components/ui/certified-pro-badge";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

type SpecialtyRow = { slug: string; name: string; icon: string | null };

type ApplicationRow = {
  id: string;
  specialty: string;
  application_text: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

type Props = {
  role: UserRole;
  initialCertified: boolean;
  initialProCertifiedAt: string | null;
  initialProSpecialtySlug: string | null;
};

export function CertifiedProMypageSection({
  role,
  initialCertified,
  initialProCertifiedAt,
  initialProSpecialtySlug,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [specialties, setSpecialties] = useState<SpecialtyRow[]>([]);
  const [isCertified, setIsCertified] = useState(initialCertified);
  const [proCertifiedAt, setProCertifiedAt] = useState(initialProCertifiedAt);
  const [proSpecialty, setProSpecialty] = useState<SpecialtyRow | null>(null);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [specialty, setSpecialty] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch("/api/pro/specialties", { credentials: "include" }),
        fetch("/api/pro/application", { credentials: "include" }),
      ]);
      if (sRes.ok) {
        const sj = (await sRes.json()) as { specialties?: SpecialtyRow[] };
        setSpecialties(sj.specialties ?? []);
      }
      if (aRes.ok) {
        const aj = (await aRes.json()) as {
          is_certified_pro?: boolean;
          pro_certified_at?: string | null;
          pro_specialty?: SpecialtyRow | null;
          application?: ApplicationRow | null;
        };
        setIsCertified(Boolean(aj.is_certified_pro));
        setProCertifiedAt(aj.pro_certified_at ?? null);
        setProSpecialty(aj.pro_specialty ?? null);
        setApplication(aj.application ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (specialties.length > 0 && !specialty) {
      setSpecialty(specialties[0]!.slug);
    }
  }, [specialties, specialty]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pro/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialty, application_text: text }),
      });
      const j = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(j.message ?? "送信に失敗しました");
        return;
      }
      setText("");
      setFormOpen(false);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function onWithdraw() {
    if (!confirm("申請を取り下げますか？")) return;
    setSubmitting(true);
    try {
      await fetch("/api/pro/application", { method: "DELETE", credentials: "include" });
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (role !== "advisor" && role !== "both" && role !== "admin") return null;

  return (
    <section className="border-border space-y-4 rounded-xl border bg-card/40 p-6">
      <h2 className="text-lg font-semibold tracking-tight">公認再生プロ</h2>

      {loading ? (
        <p className="text-muted-foreground text-sm">読み込み中…</p>
      ) : isCertified ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <CertifiedProBadge specialty={proSpecialty} size="lg" />
          </div>
          {proCertifiedAt ? (
            <p className="text-muted-foreground text-xs">
              認定日:{" "}
              {new Date(proCertifiedAt).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link href="/articles/new" className={cn(buttonVariants({ size: "sm" }), "inline-flex")}>
              コラムを書く
            </Link>
            <Link
              href="/mypage/articles"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
            >
              自分のコラム一覧
            </Link>
            <Link
              href="/mypage/contact-requests"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
            >
              相談リクエスト
            </Link>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            公認再生プロは運営が独自に認定するものであり、国家資格などの証明ではありません。
          </p>
        </div>
      ) : application?.status === "pending" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            公認再生プロ申請を受け付けました。運営からのお返事をお待ちください。
          </p>
          <p className="text-muted-foreground text-xs">
            申請日:{" "}
            {new Date(application.created_at).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => void onWithdraw()}
          >
            申請を取り下げる
          </Button>
        </div>
      ) : application?.status === "approved" && !isCertified ? (
        <p className="text-muted-foreground text-sm">
          申請は承認済みです。プロフィールの反映を確認しています…
        </p>
      ) : !formOpen ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            事業再生の専門知識や経験をお持ちの方は、公認再生プロとしてコラム投稿や相談マッチングに参加できます（運営審査あり）。
          </p>
          <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
            公認再生プロ申請をする
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pro-spec" className="text-sm font-medium">
              専門分野
            </label>
            <select
              id="pro-spec"
              className={cn(
                "border-input bg-background ring-offset-background focus-visible:ring-ring",
                "flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none",
              )}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
            >
              {specialties.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.icon ? `${s.icon} ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="pro-text" className="text-sm font-medium">
              過去の経験・専門性について（10〜1000文字）
            </label>
            <textarea
              id="pro-text"
              required
              minLength={10}
              maxLength={1000}
              rows={6}
              className={cn(
                "border-input bg-background ring-offset-background focus-visible:ring-ring",
                "min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none",
              )}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="公認再生プロとして登録するにあたり、ご経験や専門性を記載してください。"
            />
            <p className="text-muted-foreground text-xs">{text.length} / 1000文字</p>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              申請を送信する
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setFormOpen(false);
                setError(null);
              }}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
