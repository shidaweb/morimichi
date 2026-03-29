import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates/welcome";
import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Creates public.profiles from auth user_metadata when missing
 * (e.g. email confirmation delayed session, or auth user created in dashboard).
 */
export async function POST() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { created, error } = await ensureProfileForUser(supabase, user);

  if (error) {
    console.error("profile bootstrap:", error);
    return NextResponse.json({ error: "bootstrap_failed", detail: error }, { status: 500 });
  }

  if (created && user.email_confirmed_at && user.email) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("nickname, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (prof?.nickname) {
      const { subject, html, text } = welcomeEmail({
        nickname: prof.nickname,
        role: prof.role,
      });
      await sendEmail({ to: user.email, subject, html, text }).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, created });
}
