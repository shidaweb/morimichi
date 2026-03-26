import { ConsultationsList } from "@/components/consultation/ConsultationsList";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];

export default async function ConsultationsPage() {
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">相談一覧</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          フェーズや並び順を変えて、読みたい相談を見つけてください。
        </p>
      </div>
      <ConsultationsList phases={phases} />
    </div>
  );
}
