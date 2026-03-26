import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsultationForm } from "@/components/consultation/ConsultationForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Database, UserRole } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];

function canPostConsultation(role: UserRole | undefined) {
  return role === "consulter" || role === "both" || role === "admin";
}

export default async function NewConsultationPage() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">相談を投稿</h1>
        <p className="text-muted-foreground text-sm">
          環境変数（Supabase）が未設定の可能性があります。
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/consultations/new");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = profile?.role as UserRole | undefined;

  const { data: phaseRows } = await supabase
    .from("phases")
    .select("*")
    .order("sort_order", { ascending: true });

  const phases = (phaseRows ?? []) as PhaseRow[];

  if (!canPostConsultation(role)) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">相談を投稿</h1>
        <Alert>
          <AlertTitle>いまの登録では相談の投稿ができません</AlertTitle>
          <AlertDescription className="space-y-3 text-sm leading-relaxed">
            <p>
              回答者として登録されている場合、相談の新規投稿はできません。役割に「相談者」または「両方」が含まれる必要があります。
            </p>
            <p>
              マイページ（近日）で役割の変更ができるようになる予定です。しばらくお待ちいただくか、別アカウントでの登録をご検討ください。
            </p>
            <Link
              href="/consultations"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
            >
              相談一覧へ
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">相談を投稿</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          フェーズと困りごとを選び、内容を書いてください。途中で戻って編集できます。
        </p>
      </div>
      <ConsultationForm phases={phases} />
    </div>
  );
}
