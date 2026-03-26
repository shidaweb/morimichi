import { NextResponse } from "next/server";

import { fetchConsultationRepliesData } from "@/lib/consultation-replies-data";
import { notifyReplyCreated } from "@/lib/notify-reply-subscribers";
import { checkRateLimit } from "@/lib/rate-limit";
import { replyCreateSchema } from "@/lib/validations/reply";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id: consultationId } = await context.params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const result = await fetchConsultationRepliesData(supabase, consultationId);
  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({
    replies: result.replies,
    consultationReaction: result.consultationReaction,
  });
}

export async function POST(request: Request, context: Ctx) {
  const { id: consultationId } = await context.params;

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

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = replyCreateSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { body, parentReplyId, personalOpinionAck } = parsed.data;

  const isNested = Boolean(parentReplyId);
  const rl = await checkRateLimit({
    key: isNested ? `reply_nested:${user.id}` : `reply_top:${user.id}`,
    limit: isNested ? 30 : 20,
    windowSeconds: 86400,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      { status: 429 },
    );
  }

  const { data: consultation, error: cErr } = await supabase
    .from("consultations")
    .select("id, status")
    .eq("id", consultationId)
    .maybeSingle();

  if (cErr || !consultation || consultation.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let depth = 1;
  let parentId: string | null = null;

  if (parentReplyId) {
    const { data: parent, error: pErr } = await supabase
      .from("replies")
      .select("id, consultation_id, depth, status")
      .eq("id", parentReplyId)
      .maybeSingle();

    if (pErr || !parent || parent.status !== "published") {
      return NextResponse.json({ error: "invalid_parent" }, { status: 400 });
    }
    if (parent.consultation_id !== consultationId) {
      return NextResponse.json({ error: "parent_mismatch" }, { status: 400 });
    }
    if (parent.depth !== 1) {
      return NextResponse.json({ error: "max_depth" }, { status: 400 });
    }
    depth = 2;
    parentId = parent.id;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("replies")
    .insert({
      consultation_id: consultationId,
      user_id: user.id,
      parent_reply_id: parentId,
      body,
      depth,
      status: "published",
      personal_opinion_ack: depth === 1 ? Boolean(personalOpinionAck) : false,
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    if (/permission|policy|rls|row-level/i.test(insErr.message) || insErr.code === "42501") {
      return NextResponse.json(
        {
          error: "forbidden",
          message:
            depth === 1
              ? "トップレベルの回答には「回答者」または「両方」の登録が必要です。"
              : "返信にはログインが必要です。",
        },
        { status: 403 },
      );
    }
    console.error(insErr);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  void notifyReplyCreated({
    supabase,
    consultationId,
    depth,
    parentReplyId: parentId,
    authorUserId: user.id,
  }).catch((err) => console.error("notifyReplyCreated", err));

  return NextResponse.json({ id: inserted?.id });
}
