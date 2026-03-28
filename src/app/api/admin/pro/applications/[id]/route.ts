import { NextResponse } from "next/server";

import {
  sendProApplicationApprovedToUser,
  sendProApplicationRejectedToUser,
} from "@/lib/email/certified-pro-mail";
import { getAdminContext } from "@/lib/admin-auth";
import { getAuthUserEmailById } from "@/lib/supabase/auth-user-email";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const admin = await getAdminContext(supabase);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const action = o.action;
  const reviewerNote =
    typeof o.reviewer_note === "string" ? o.reviewer_note.trim().slice(0, 2000) : null;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { data: app, error: fetchErr } = await supabase
    .from("pro_applications")
    .select("id, user_id, specialty, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (app.status !== "pending") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === "approve") {
    const { error: upApp } = await supabase
      .from("pro_applications")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: admin.userId,
        reviewer_note: reviewerNote,
        updated_at: now,
      })
      .eq("id", id);

    if (upApp) {
      console.error(upApp);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    const { error: upProf } = await supabase
      .from("profiles")
      .update({
        is_certified_pro: true,
        pro_specialty: app.specialty,
        pro_certified_at: now,
        updated_at: now,
      })
      .eq("user_id", app.user_id);

    if (upProf) {
      console.error(upProf);
      return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
    }

    const email = await getAuthUserEmailById(app.user_id);
    if (email) void sendProApplicationApprovedToUser(email);

    return NextResponse.json({ ok: true, status: "approved" });
  }

  const { error: upApp } = await supabase
    .from("pro_applications")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: admin.userId,
      reviewer_note: reviewerNote,
      updated_at: now,
    })
    .eq("id", id);

  if (upApp) {
    console.error(upApp);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const email = await getAuthUserEmailById(app.user_id);
  if (email) void sendProApplicationRejectedToUser(email);

  return NextResponse.json({ ok: true, status: "rejected" });
}
