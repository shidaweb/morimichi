import { NextResponse } from "next/server";
import { z } from "zod";

import { getModeratorContext } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email/send";
import { reportResolvedEmail } from "@/lib/email/templates/report-resolved";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/types/database";

const patchSchema = z.object({
  status: z.enum(["pending", "reviewing", "resolved", "dismissed"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const mod = await getModeratorContext(supabase);
  if (!mod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const status = parsed.data.status as ReportStatus;
  const resolvedAt =
    status === "resolved" || status === "dismissed" ? new Date().toISOString() : null;

  const { data: prev, error: prevErr } = await supabase
    .from("reports")
    .select("status, reporter_user_id")
    .eq("id", id)
    .maybeSingle();

  if (prevErr || !prev) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("reports")
    .update({
      status,
      resolved_at: resolvedAt,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const shouldNotifyResolved =
    status === "resolved" && prev.status !== "resolved";

  if (shouldNotifyResolved) {
    try {
      const admin = createAdminSupabaseClient();
      const { data: repProf } = await admin
        .from("profiles")
        .select("nickname")
        .eq("user_id", prev.reporter_user_id)
        .maybeSingle();
      const { data: authData } = await admin.auth.admin.getUserById(
        prev.reporter_user_id,
      );
      const to = authData.user?.email;
      if (to) {
        const { subject, html, text } = reportResolvedEmail({
          nickname: repProf?.nickname ?? "ご利用者",
        });
        await sendEmail({ to, subject, html, text }).catch(console.error);
      }
    } catch (e) {
      console.error("report resolved email skipped:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
