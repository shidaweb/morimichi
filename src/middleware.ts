import { type NextRequest, NextResponse } from "next/server";

import { getMiddlewareUser } from "@/lib/supabase/middleware";

const protectedMatchers = [
  /^\/mypage(\/|$)/,
  /^\/consultations\/new(\/|$)/,
  /^\/withdrawal(\/|$)/,
  /^\/admin(\/|$)/,
];

function isProtectedPath(pathname: string) {
  return protectedMatchers.some((re) => re.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  try {
    const { user } = await getMiddlewareUser(request);
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/mypage/:path*", "/consultations/new", "/withdrawal/:path*", "/admin/:path*"],
};
