"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ProMemberCard, type ProMemberCardMember } from "@/components/pro/pro-member-card";
import { ContactRequestModal } from "@/components/pro/contact-request-modal";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type Spec = { slug: string; name: string; icon: string | null };

function ProMembersPageInner() {
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<ProMemberCardMember[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [contactMember, setContactMember] = useState<ProMemberCardMember | null>(null);
  const [specialties, setSpecialties] = useState<Spec[]>([]);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const specialty = searchParams.get("specialty") ?? "";
  const sort = searchParams.get("sort") ?? "replies";
  const phase = searchParams.get("phase") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("limit", "20");
      if (specialty) q.set("specialty", specialty);
      if (sort) q.set("sort", sort);
      if (phase) q.set("phase", phase);
      const res = await fetch(`/api/pro/members?${q.toString()}`);
      const j = (await res.json()) as {
        members?: ProMemberCardMember[];
        total?: number;
        total_pages?: number;
      };
      setMembers(j.members ?? []);
      setTotal(j.total ?? 0);
      setTotalPages(j.total_pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, specialty, sort, phase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/pro/specialties");
      if (!res.ok) return;
      const j = (await res.json()) as { specialties?: Spec[] };
      setSpecialties(j.specialties ?? []);
    })();
  }, []);

  function hrefWithQuery(updates: Record<string, string | undefined>) {
    const q = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") q.delete(k);
      else q.set(k, v);
    }
    if (!updates.page) q.delete("page");
    const s = q.toString();
    return s ? `/pro?${s}` : "/pro";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">公認再生プロ一覧</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          運営が認定した事業再生の専門家・経験者です。公認再生プロは運営独自の認定であり、国家資格の証明ではありません。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-medium">専門分野</span>
        <div className="flex flex-wrap gap-2">
          <Link
            href={hrefWithQuery({ specialty: undefined, page: undefined })}
            className={cn(
              buttonVariants({ size: "sm", variant: !specialty ? "secondary" : "outline" }),
              "inline-flex",
            )}
          >
            すべて
          </Link>
          {specialties.map((s) => (
            <Link
              key={s.slug}
              href={hrefWithQuery({ specialty: s.slug, page: undefined })}
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: specialty === s.slug ? "secondary" : "outline",
                }),
                "inline-flex",
              )}
            >
              {s.icon ? `${s.icon} ` : ""}
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-medium">並び替え</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["replies", "回答が多い順"],
              ["reactions", "共感が多い順"],
              ["newest", "新着（認定順）"],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              href={hrefWithQuery({ sort: k, page: undefined })}
              className={cn(
                buttonVariants({ size: "sm", variant: sort === k ? "secondary" : "outline" }),
                "inline-flex",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">読み込み中…</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">結果: {total}名</p>
          <ul className="flex flex-col gap-4">
            {members.map((m) => (
              <li key={m.nickname}>
                <ProMemberCard
                  member={m}
                  onContactClick={(mem) => setContactMember(mem)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="ページ送り">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={hrefWithQuery({ page: String(p) })}
              className={cn(
                buttonVariants({ size: "sm", variant: p === page ? "default" : "outline" }),
                "inline-flex min-w-[2.25rem] justify-center",
              )}
            >
              {p}
            </Link>
          ))}
        </nav>
      ) : null}

      <ContactRequestModal
        open={Boolean(contactMember)}
        onClose={() => setContactMember(null)}
        targetUserId={contactMember?.user_id ?? ""}
        targetNickname={contactMember?.nickname ?? ""}
        targetAvatarUrl={contactMember?.avatar_url ?? null}
        targetSpecialty={contactMember?.pro_specialty ?? null}
        isCertifiedPro
      />
    </div>
  );
}

export default function ProMembersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl">
          <p className="text-muted-foreground text-sm">読み込み中…</p>
        </div>
      }
    >
      <ProMembersPageInner />
    </Suspense>
  );
}
