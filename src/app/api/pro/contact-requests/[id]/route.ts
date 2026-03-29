import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email/send";
import { contactRespondedEmail } from "@/lib/email/templates/contact-responded";
import { getAuthUserEmailById } from "@/lib/supabase/auth-user-email";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Pro marks a forwarded contact request as responded; notifies requester (D-6).
 */
export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = (body as { action?: string }).action;
  if (action !== "respond") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { data: row, error: fe } = await supabase
    .from("contact_requests")
    .select("id, status, requester_user_id, target_pro_user_id")
    .eq("id", id)
    .maybeSingle();

  if (fe || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (row.target_pro_user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (row.status !== "forwarded") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("contact_requests")
    .update({
      status: "responded",
      responded_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (upErr) {
    console.error(upErr);
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

  const requesterEmail = await getAuthUserEmailById(row.requester_user_id);
  if (requesterEmail) {
    const { subject, html, text } = contactRespondedEmail({
      requesterNickname: reqProf?.nickname ?? "ご利用者",
      proNickname: proProf?.nickname ?? "公認再生プロ",
    });
    void sendEmail({ to: requesterEmail, subject, html, text }).catch(console.error);
  }

  return NextResponse.json({ ok: true, status: "responded" });
}
