import Link from "next/link";
import { notFound } from "next/navigation";

import { CrisisBanner } from "@/components/common/CrisisBanner";
import { DisclaimerBanner } from "@/components/common/DisclaimerBanner";
import { ConsultationDetailClient } from "@/components/consultation/ConsultationDetailClient";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { fetchConsultationRepliesData } from "@/lib/consultation-replies-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Database, UserRole } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

function canPostTopLevelReply(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === "advisor" || role === "both" || role === "moderator" || role === "admin";
}

export default async function ConsultationDetailPage({ params }: Props) {
  const { id } = await params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    notFound();
  }

  const { data: c, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !c || c.status !== "published") {
    notFound();
  }

  const row = c as Database["public"]["Tables"]["consultations"]["Row"];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canPostTopLevel = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    canPostTopLevel = canPostTopLevelReply(profile?.role as UserRole | undefined);
  }

  const { data: phase } = await supabase
    .from("phases")
    .select("name, slug, icon")
    .eq("id", row.phase_id)
    .maybeSingle();

  const { data: ccRows } = await supabase
    .from("consultation_concerns")
    .select("concern_id")
    .eq("consultation_id", id);

  const concernIds = (ccRows ?? []).map((r) => r.concern_id);
  let concernLabels: string[] = [];
  if (concernIds.length > 0) {
    const { data: concerns } = await supabase
      .from("concerns")
      .select("label")
      .in("id", concernIds);
    concernLabels = (concerns ?? []).map((x) => x.label);
  }

  const repliesData = await fetchConsultationRepliesData(supabase, id);
  const initialReplies =
    repliesData.ok ? repliesData.replies : [];
  const initialConsultationReaction = repliesData.ok
    ? repliesData.consultationReaction
    : {
        empathyCount: row.reaction_count ?? 0,
        hasMyEmpathy: false,
      };
  const initialThreadError = repliesData.ok
    ? null
    : "回答の読み込みに失敗しました";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DisclaimerBanner />

      {row.crisis_flag ? <CrisisBanner /> : null}

      <div className="flex flex-wrap items-center gap-2">
        {phase ? (
          <Badge variant="secondary">
            <span className="mr-1">{phase.icon}</span>
            {phase.name}
          </Badge>
        ) : null}
      </div>

      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {row.title}
        </h1>
      </header>

      <ConsultationDetailClient
        consultationId={id}
        initialViewCount={row.view_count ?? 0}
        initialReplyCount={row.reply_count ?? 0}
        initialReactionCount={row.reaction_count ?? 0}
        initialReplies={initialReplies}
        initialConsultationReaction={initialConsultationReaction}
        initialThreadError={initialThreadError}
        canPostTopLevel={canPostTopLevel}
        isLoggedIn={Boolean(user)}
      >
        {concernLabels.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            困りごと: {concernLabels.join("、")}
          </p>
        ) : null}

        <div className="text-foreground whitespace-pre-wrap text-base leading-relaxed">
          {row.body}
        </div>
      </ConsultationDetailClient>

      <Link
        href="/consultations"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
      >
        一覧へ戻る
      </Link>
    </div>
  );
}
