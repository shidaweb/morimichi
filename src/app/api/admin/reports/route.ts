import { NextResponse } from "next/server";

import { getModeratorContext } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

export async function GET() {
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

  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const list = (reports ?? []) as ReportRow[];
  const cIds = list
    .filter((r) => r.target_type === "consultation")
    .map((r) => r.target_id);
  const rIds = list.filter((r) => r.target_type === "reply").map((r) => r.target_id);

  const titleByConsultation = new Map<string, string>();
  if (cIds.length > 0) {
    const { data: cs } = await supabase
      .from("consultations")
      .select("id,title")
      .in("id", [...new Set(cIds)]);
    for (const c of cs ?? []) titleByConsultation.set(c.id, c.title);
  }

  const replyPreview = new Map<string, string>();
  if (rIds.length > 0) {
    const { data: rs } = await supabase
      .from("replies")
      .select("id,body,consultation_id")
      .in("id", [...new Set(rIds)]);
    for (const r of rs ?? []) {
      const snippet = r.body.length > 80 ? `${r.body.slice(0, 80)}…` : r.body;
      replyPreview.set(r.id, snippet);
    }
  }

  const payload = list.map((r) => ({
    ...r,
    targetLabel:
      r.target_type === "consultation"
        ? (titleByConsultation.get(r.target_id) ?? "(取得できませんでした)")
        : (replyPreview.get(r.target_id) ?? "(取得できませんでした)"),
  }));

  return NextResponse.json({ reports: payload });
}
