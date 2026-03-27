import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type ModeratorContext = {
  userId: string;
  role: "moderator" | "admin";
};

export async function getModeratorContext(
  supabase: SupabaseClient<Database>,
): Promise<ModeratorContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (role !== "moderator" && role !== "admin") return null;

  return { userId: user.id, role };
}
