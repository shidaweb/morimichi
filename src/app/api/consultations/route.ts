import { type NextRequest, NextResponse } from "next/server";

import {
  decodeCursor,
  encodeCursor,
  nextCursorFromRow,
  type SortMode,
} from "@/lib/consultation-cursor";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  fetchProSpecialtyBadgeMap,
  resolveProBadge,
} from "@/lib/pro/pro-specialty-badge";
import { consultationCreateSchema } from "@/lib/validations/consultation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SORTS: SortMode[] = ["new", "replies", "views"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const phaseSlug = searchParams.get("phase") ?? "all";
  const sort = (searchParams.get("sort") ?? "new") as SortMode;
  const cursorRaw = searchParams.get("cursor");

  if (!SORTS.includes(sort)) {
    return NextResponse.json({ error: "invalid_sort" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let phaseId: string | null = null;
  if (phaseSlug !== "all") {
    const { data: ph } = await supabase
      .from("phases")
      .select("id")
      .eq("slug", phaseSlug)
      .maybeSingle();
    if (!ph) {
      return NextResponse.json({ error: "invalid_phase" }, { status: 400 });
    }
    phaseId = ph.id;
  }

  const cur = decodeCursor(cursorRaw);
  if (cursorRaw && !cur) {
    return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
  }
  if (cur && cur.s !== sort) {
    return NextResponse.json({ error: "cursor_sort_mismatch" }, { status: 400 });
  }

  const rpcArgs = {
    p_phase_id: phaseId,
    p_sort: sort,
    p_limit: 21,
    p_after_created_at: null as string | null,
    p_after_id: null as string | null,
    p_after_reply_count: null as number | null,
    p_after_view_count: null as number | null,
  };

  if (cur) {
    rpcArgs.p_after_created_at = cur.c;
    rpcArgs.p_after_id = cur.i;
    if (cur.s === "replies") rpcArgs.p_after_reply_count = cur.r;
    if (cur.s === "views") rpcArgs.p_after_view_count = cur.v;
  }

  const { data: rows, error } = await supabase.rpc("fetch_consultations", rpcArgs);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 500 });
  }

  const list = rows ?? [];
  const hasMore = list.length > 20;
  const page = hasMore ? list.slice(0, 20) : list;

  const phaseIds = [...new Set(page.map((r) => r.phase_id))];
  const phaseMap = new Map<
    string,
    { name: string; slug: string; icon: string | null }
  >();
  if (phaseIds.length > 0) {
    const { data: phases } = await supabase
      .from("phases")
      .select("id,name,slug,icon")
      .in("id", phaseIds);
    for (const p of phases ?? []) {
      phaseMap.set(p.id, { name: p.name, slug: p.slug, icon: p.icon });
    }
  }

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(nextCursorFromRow(last, sort)) : null;

  const authorUserIds = [
    ...new Set(page.map((r) => r.user_id).filter(Boolean)),
  ] as string[];
  const authorByUserId = new Map<
    string,
    {
      nickname: string;
      avatar_url: string | null;
      is_profile_public: boolean;
      role: string;
      is_certified_pro: boolean;
      pro_specialty: string | null;
    }
  >();
  if (authorUserIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select(
        "user_id, nickname, avatar_url, is_profile_public, role, is_certified_pro, pro_specialty",
      )
      .in("user_id", authorUserIds);
    for (const p of profs ?? []) {
      authorByUserId.set(p.user_id, {
        nickname: p.nickname,
        avatar_url: p.avatar_url,
        is_profile_public: p.is_profile_public,
        role: p.role,
        is_certified_pro: Boolean(p.is_certified_pro),
        pro_specialty: p.pro_specialty ?? null,
      });
    }
  }

  const badgeMap = await fetchProSpecialtyBadgeMap(
    supabase,
    [...authorByUserId.values()].map((a) => a.pro_specialty),
  );

  return NextResponse.json({
    items: page.map((r) => {
      const ap = r.user_id ? authorByUserId.get(r.user_id) : undefined;
      const isCertified = Boolean(ap?.is_certified_pro);
      const pro_specialty = ap
        ? resolveProBadge(isCertified, ap.pro_specialty, badgeMap)
        : null;
      return {
        ...r,
        phase: phaseMap.get(r.phase_id) ?? null,
        author: ap
          ? {
              nickname: ap.nickname,
              avatar_url: ap.avatar_url,
              is_profile_public: ap.is_profile_public,
              role: ap.role,
              is_certified_pro: isCertified,
              pro_specialty,
            }
          : null,
      };
    }),
    nextCursor,
  });
}

export async function POST(request: Request) {
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

  const rl = await checkRateLimit({
    key: `consultation:${user.id}`,
    limit: 3,
    windowSeconds: 86400,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = consultationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { phaseId, concernIds, title, body: textBody } = parsed.data;

  const { data: id, error } = await supabase.rpc("create_consultation_post", {
    p_phase_id: phaseId,
    p_title: title,
    p_body: textBody,
    p_concern_ids: concernIds,
  });

  if (error) {
    const msg = error.message ?? "";
    if (
      /permission|policy|rls|row-level/i.test(msg) ||
      error.code === "42501"
    ) {
      return NextResponse.json(
        {
          error: "forbidden",
          message:
            "相談の投稿には「相談者」または「両方」の登録が必要です。マイページで役割をご確認ください。",
        },
        { status: 403 },
      );
    }
    if (/concerns_required|invalid_concerns/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "create_failed", message: msg }, { status: 500 });
  }

  return NextResponse.json({ id });
}
