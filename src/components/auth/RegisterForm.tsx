"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { RoleSelector } from "@/components/auth/RoleSelector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncAuthCookies } from "@/lib/auth/sync-session";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";
import type { Database } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];

type Props = {
  phases: PhaseRow[];
  siteUrl: string;
};

export function RegisterForm({ phases, siteUrl }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const supabase = useSupabaseBrowser();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      nickname: "",
      role: "consulter",
      experiencePhases: [],
      agreeTerms: false,
    },
  });

  const role = form.watch("role");
  const experiencePhases = form.watch("experiencePhases") ?? [];

  const togglePhase = (slug: string) => {
    const next = new Set(experiencePhases);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    form.setValue("experiencePhases", [...next], { shouldValidate: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!supabase) return;
    setServerError(null);
    const redirectUrl = `${siteUrl.replace(/\/$/, "")}/verify-email`;

    const experience =
      values.role === "consulter" ? null : values.experiencePhases ?? null;

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nickname: values.nickname,
          role: values.role,
          experience_phases:
            experience && experience.length > 0 ? experience : null,
        },
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setServerError("登録に失敗しました。しばらくしてからお試しください。");
      return;
    }

    if (data.session) {
      try {
        await syncAuthCookies(
          data.session.access_token,
          data.session.refresh_token,
        );
      } catch {
        setServerError("セッションの保存に失敗しました。もう一度お試しください。");
        return;
      }

      const boot = await fetch("/api/profile/bootstrap", { method: "POST" });
      if (!boot.ok) {
        const body = (await boot.json().catch(() => null)) as { detail?: string } | null;
        setServerError(
          body?.detail ??
            "プロフィールの作成に失敗しました。しばらくしてから再度お試しください。",
        );
        return;
      }

      router.push("/consultations");
      router.refresh();
      return;
    }

    setServerError(null);
    router.push("/verify-email");
  });

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">アカウントを作成</CardTitle>
        <CardDescription>
          ニックネームは公開されます。メールアドレスは他の利用者には表示されません。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit} aria-busy={!supabase}>
          {serverError ? (
            <Alert variant="destructive">
              <AlertTitle>登録できませんでした</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <RoleSelector
            value={role}
            onChange={(v) => {
              form.setValue("role", v, { shouldValidate: true });
              if (v === "consulter") {
                form.setValue("experiencePhases", []);
              }
            }}
            disabled={form.formState.isSubmitting || !supabase}
          />

          {(role === "advisor" || role === "both") && (
            <div className="space-y-2">
              <Label>経験したことのあるフェーズ（複数可）</Label>
              <p className="text-muted-foreground text-sm">
                回答者として、どの領域の経験を共有できるか選んでください。
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {phases.map((p) => (
                  <label
                    key={p.id}
                    className="border-border flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={experiencePhases.includes(p.slug)}
                      onCheckedChange={() => togglePhase(p.slug)}
                      disabled={form.formState.isSubmitting || !supabase}
                    />
                    <span>
                      <span className="mr-1">{p.icon}</span>
                      {p.name}
                    </span>
                  </label>
                ))}
              </div>
              {form.formState.errors.experiencePhases ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.experiencePhases.message}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nickname">ニックネーム（2〜20文字）</Label>
            <Input
              id="nickname"
              autoComplete="nickname"
              {...form.register("nickname")}
              disabled={form.formState.isSubmitting || !supabase}
            />
            {form.formState.errors.nickname ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.nickname.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register("email")}
              disabled={form.formState.isSubmitting || !supabase}
            />
            {form.formState.errors.email ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード（8文字以上）</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
              disabled={form.formState.isSubmitting || !supabase}
            />
            {form.formState.errors.password ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Checkbox
              checked={form.watch("agreeTerms")}
              onCheckedChange={(c) =>
                form.setValue("agreeTerms", c === true, { shouldValidate: true })
              }
              disabled={form.formState.isSubmitting || !supabase}
            />
            <span>
              <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                利用規約
              </Link>
              および
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                プライバシーポリシー
              </Link>
              に同意します
            </span>
          </label>
          {form.formState.errors.agreeTerms ? (
            <p className="text-destructive text-sm">
              {form.formState.errors.agreeTerms.message}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={form.formState.isSubmitting || !supabase}
          >
            {!supabase
              ? "準備中…"
              : form.formState.isSubmitting
                ? "送信中…"
                : "登録する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
