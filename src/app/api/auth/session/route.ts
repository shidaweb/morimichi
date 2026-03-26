import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_ACCESS, AUTH_COOKIE_REFRESH } from "@/lib/constants";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("access_token" in body) ||
    !("refresh_token" in body)
  ) {
    return NextResponse.json({ error: "missing_tokens" }, { status: 400 });
  }
  const { access_token, refresh_token } = body as {
    access_token: string;
    refresh_token: string;
  };
  if (
    typeof access_token !== "string" ||
    typeof refresh_token !== "string" ||
    !access_token ||
    !refresh_token
  ) {
    return NextResponse.json({ error: "invalid_tokens" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_ACCESS, access_token, cookieOptions);
  cookieStore.set(AUTH_COOKIE_REFRESH, refresh_token, cookieOptions);

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_ACCESS);
  cookieStore.delete(AUTH_COOKIE_REFRESH);
  return NextResponse.json({ ok: true });
}
