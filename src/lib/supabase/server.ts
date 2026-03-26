import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { AUTH_COOKIE_ACCESS, AUTH_COOKIE_REFRESH } from "@/lib/constants";
import type { Database } from "@/types/database";

function serverAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_ACCESS)?.value;
  const refreshToken = cookieStore.get(AUTH_COOKIE_REFRESH)?.value;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = serverAnonKey();
  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or anon key for server client");
  }

  const supabase = createClient<Database>(url, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (refreshToken && accessToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return supabase;
}
