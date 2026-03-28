import { NextResponse } from "next/server";

import { getPublicProfileByNickname, resolveViewer } from "@/lib/profile/public-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ nickname: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { nickname: raw } = await context.params;
  const nickname = decodeURIComponent(raw).trim();
  if (!nickname) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewer = await resolveViewer(supabase, user?.id ?? null);

  const profile = await getPublicProfileByNickname(supabase, nickname, viewer);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
