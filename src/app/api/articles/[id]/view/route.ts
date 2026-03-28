import { NextResponse } from "next/server";

import { hashIpForView } from "@/lib/ip-hash";
import { getClientIp } from "@/lib/request-ip";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id: articleId } = await context.params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { data: art } = await supabase
    .from("articles")
    .select("id, status")
    .eq("id", articleId)
    .maybeSingle();

  if (!art || art.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ip = getClientIp(request);
  const ipHash = hashIpForView(ip);

  const { error } = await supabase.from("article_views").insert({
    article_id: articleId,
    viewer_id: user?.id ?? null,
    ip_hash: ipHash,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ counted: false, duplicate: true });
    }
    console.error(error);
    return NextResponse.json({ error: "view_record_failed" }, { status: 400 });
  }

  const { data: cur } = await supabase
    .from("articles")
    .select("view_count")
    .eq("id", articleId)
    .maybeSingle();

  const next = (cur?.view_count ?? 0) + 1;
  const { error: upErr } = await supabase
    .from("articles")
    .update({ view_count: next })
    .eq("id", articleId);

  if (upErr) {
    console.error(upErr);
  }

  return NextResponse.json({ counted: true });
}
