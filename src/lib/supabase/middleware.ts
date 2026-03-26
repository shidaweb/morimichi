import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_ACCESS, AUTH_COOKIE_REFRESH } from "@/lib/constants";
import type { Database } from "@/types/database";

function serverAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}

export function createMiddlewareSupabaseClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = serverAnonKey();
  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or anon key");
  }

  const accessToken = request.cookies.get(AUTH_COOKIE_ACCESS)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIE_REFRESH)?.value;

  const supabase = createClient<Database>(url, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { supabase, accessToken, refreshToken };
}

export async function getMiddlewareUser(request: NextRequest) {
  const { supabase, accessToken, refreshToken } =
    createMiddlewareSupabaseClient(request);

  if (refreshToken && accessToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { user: null, supabase };
  }
  return { user: data.user, supabase };
}
