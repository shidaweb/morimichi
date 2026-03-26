import { RegisterForm } from "@/components/auth/RegisterForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];

export default async function RegisterPage() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let phases: PhaseRow[] = [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("phases")
      .select("*")
      .order("sort_order", { ascending: true });
    phases = (data ?? []) as PhaseRow[];
  } catch {
    phases = [];
  }

  return <RegisterForm phases={phases} siteUrl={siteUrl} />;
}
