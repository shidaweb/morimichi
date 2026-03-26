import { NextResponse } from "next/server";

import { reportCreateSchema } from "@/lib/validations/report";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ReactionTarget } from "@/types/database";

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

  const { error } = await supabase.from("reports").insert({
    reporter_user_id: user.id,
    target_type: targetType as ReactionTarget,
    target_id: targetId,
    reason,
    detail: detail ?? null,
    status: "pending",
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "report_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
