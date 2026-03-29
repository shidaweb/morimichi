import { NextResponse } from "next/server";

import { sendAdminEmail } from "@/lib/email/send";
import { reportSubmittedEmail } from "@/lib/email/templates/report-submitted";
import { reportCreateSchema } from "@/lib/validations/report";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ReactionTarget } from "@/types/database";

const REPORT_REASON_LABEL: Record<string, string> = {
  defamation: "誹謗中傷",
  solicitation: "勧誘",
  crisis: "危機的状況の示唆",
  personal_info: "個人情報",
  illegal: "違法行為",
  misinformation: "誤情報",
  legal_advice: "法律相談の不適切な行為",
  advisor_solicitation: "回答者による勧誘",
  spam: "スパム",
  other: "その他",
  auto_detected_contact_info: "連絡先の自動検知",
};

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = reportCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { targetType, targetId, reason, detail } = parsed.data;

  if (targetType === "consultation") {
    const { data: c } = await supabase
      .from("consultations")
      .select("id")
      .eq("id", targetId)
      .eq("status", "published")
      .maybeSingle();
    if (!c) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } else {
    const { data: r } = await supabase
      .from("replies")
      .select("id")
      .eq("id", targetId)
      .eq("status", "published")
      .maybeSingle();
    if (!r) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const { data: inserted, error } = await supabase
    .from("reports")
    .insert({
      reporter_user_id: user.id,
      target_type: targetType as ReactionTarget,
      target_id: targetId,
      reason,
      detail: detail ?? null,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: "duplicate_report",
          message: "同じ内容の通報が既に受付済みです。しばらくお待ちください。",
        },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "report_failed" }, { status: 500 });
  }

  const reportId = inserted?.id;
  if (reportId) {
    const { data: reporterProf } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", user.id)
      .maybeSingle();

    let targetTitle = "(無題)";
    if (targetType === "consultation") {
      const { data: c } = await supabase
        .from("consultations")
        .select("title")
        .eq("id", targetId)
        .maybeSingle();
      targetTitle = c?.title?.trim() || targetTitle;
    } else {
      const { data: r } = await supabase
        .from("replies")
        .select("body")
        .eq("id", targetId)
        .maybeSingle();
      const snippet = r?.body?.trim().slice(0, 80) ?? "";
      targetTitle = snippet.length > 0 ? snippet : targetTitle;
    }

    const emailData = reportSubmittedEmail({
      reporterNickname: reporterProf?.nickname ?? "ご利用者",
      targetType: targetType as "consultation" | "reply",
      targetTitle,
      reason: REPORT_REASON_LABEL[reason] ?? reason,
      detail: detail ?? null,
      reportId,
    });
    void sendAdminEmail(emailData).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
