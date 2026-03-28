import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function getAuthUserEmailById(userId: string): Promise<string | null> {
  const svc = createServiceSupabaseClient();
  if (!svc) return null;
  const { data, error } = await svc.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}
