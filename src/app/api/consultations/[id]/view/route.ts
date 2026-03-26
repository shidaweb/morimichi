import { NextResponse } from "next/server";

import { hashIpForView } from "@/lib/ip-hash";
import { getClientIp } from "@/lib/request-ip";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id: consultationId } = await context.params;

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ip = getClientIp(request);
  const ipHash = hashIpForView(ip);

  const { error } = await supabase.from("consultation_views").insert({
    consultation_id: consultationId,
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

  return NextResponse.json({ counted: true });
}
