import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** メール送信用など、RLS を越えて auth ユーザー情報を読む場合に限定して使用 */
export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
