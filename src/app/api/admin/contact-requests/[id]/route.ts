import { NextResponse } from "next/server";

import { sendContactRequestForwardedToPro } from "@/lib/email/certified-pro-mail";
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
  const adminNote =
    typeof o.admin_note === "string" ? o.admin_note.trim().slice(0, 2000) : null;

  if (action !== "forward" && action !== "close" && action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { data: row, error: fe } = await supabase
    .from("contact_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fe || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (action === "forward") {
    if (row.status !== "pending") {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    const { error } = await supabase
      .from("contact_requests")
      .update({
        status: "forwarded",
        forwarded_at: now,
        admin_note: adminNote ?? row.admin_note,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    const { data: reqProf } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", row.requester_user_id)
      .maybeSingle();

    const { data: proProf } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", row.target_pro_user_id)
      .maybeSingle();

    const proEmail = await getAuthUserEmailById(row.target_pro_user_id);
    if (proEmail) {
      void sendContactRequestForwardedToPro({
        to: proEmail,
        subjectLine: row.subject,
        message: row.message,
        requesterNickname: reqProf?.nickname ?? "利用者",
        proNickname: proProf?.nickname ?? "ご利用者",
      });
    }

    return NextResponse.json({ ok: true, status: "forwarded" });
  }

  if (action === "close") {
    const { error } = await supabase
      .from("contact_requests")
      .update({
        status: "closed",
        admin_note: adminNote ?? row.admin_note,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "closed" });
  }

  const { error } = await supabase
    .from("contact_requests")
    .update({
      status: "rejected",
      admin_note: adminNote ?? row.admin_note,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "rejected" });
}
