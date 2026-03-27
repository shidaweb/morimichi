import { NextResponse } from "next/server";

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

  return NextResponse.json({ ok: true, created });
}
