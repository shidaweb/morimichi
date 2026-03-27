import { NextResponse } from "next/server";
import { z } from "zod";

import { getModeratorContext } from "@/lib/admin-auth";
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

  return NextResponse.json({ ok: true });
}
