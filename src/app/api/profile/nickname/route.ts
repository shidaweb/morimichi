import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  nickname: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(2, "ニックネームは2文字以上にしてください")
        .max(20, "ニックネームは20文字以内にしてください"),
    ),
});

export async function PATCH(request: Request) {
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
    const first = parsed.error.flatten().fieldErrors.nickname?.[0];
    return NextResponse.json(
      { error: "validation", message: first ?? "invalid_nickname" },
      { status: 400 },
    );
  }

  const nickname = parsed.data.nickname;

  let { data: existing } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr) {
      console.error("profile bootstrap before nickname:", bootErr);
      return NextResponse.json(
        { error: "profile_missing", message: "プロフィールを作成できませんでした" },
        { status: 500 },
      );
    }
    const { data: created } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", user.id)
      .maybeSingle();
    existing = created;
  }

  if (!existing) {
    return NextResponse.json({ error: "profile_missing" }, { status: 500 });
  }

  if (existing.nickname === nickname) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      nickname,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    const code = "code" in error ? String(error.code) : "";
    const msg = error.message?.toLowerCase() ?? "";
    const isUnique =
      code === "23505" || msg.includes("unique") || msg.includes("duplicate");
    if (isUnique) {
      return NextResponse.json(
        { error: "nickname_taken", message: "このニックネームはすでに使われています" },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
