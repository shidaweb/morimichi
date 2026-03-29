import { NextResponse } from "next/server";

import { z } from "zod";

import { notifyReactionCreated } from "@/lib/notify-reaction-subscribers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ReactionTarget } from "@/types/database";

const bodySchema = z.object({
  targetType: z.enum(["consultation", "reply"]),
  targetId: z.string().uuid(),
});

function sameAuthUser(authorId: string | null | undefined, userId: string): boolean {
  if (!authorId) return false;
  return (
    authorId.replace(/-/g, "").toLowerCase() === userId.replace(/-/g, "").toLowerCase()
  );
}

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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const { targetType, targetId } = parsed.data;

  if (targetType === "consultation") {
    const { data: c } = await supabase
      .from("consultations")
      .select("id, status, user_id")
      .eq("id", targetId)
      .maybeSingle();
    if (!c || c.status !== "published") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (sameAuthUser(c.user_id, user.id)) {
      return NextResponse.json({ error: "cannot_react_own" }, { status: 400 });
    }
  } else {
    const { data: r } = await supabase
      .from("replies")
      .select("id, status, user_id")
      .eq("id", targetId)
      .maybeSingle();
    if (!r || r.status !== "published") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (sameAuthUser(r.user_id, user.id)) {
      return NextResponse.json({ error: "cannot_react_own" }, { status: 400 });
    }
  }

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_type", targetType as ReactionTarget)
    .eq("target_id", targetId)
    .eq("reaction_type", "empathy")
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await supabase
      .from("reactions")
      .delete()
      .eq("id", existing.id);
    if (delErr) {
      console.error(delErr);
      return NextResponse.json({ error: "toggle_failed" }, { status: 500 });
    }
    return NextResponse.json({ active: false });
  }

  const { error: insErr } = await supabase.from("reactions").insert({
    user_id: user.id,
    target_type: targetType as ReactionTarget,
    target_id: targetId,
    reaction_type: "empathy",
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ active: false, duplicate: true });
    }
    const msg = insErr.message ?? "";
    if (
      insErr.code === "42501" ||
      /policy|row-level|violates row-level security/i.test(msg)
    ) {
      return NextResponse.json({ error: "cannot_react_own" }, { status: 400 });
    }
    console.error(insErr);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  void notifyReactionCreated({
    supabase,
    targetType: targetType as ReactionTarget,
    targetId,
    actorUserId: user.id,
  }).catch(console.error);

  return NextResponse.json({ active: true });
}
