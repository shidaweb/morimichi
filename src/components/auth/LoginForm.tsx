"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncAuthCookies } from "@/lib/auth/sync-session";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/consultations";
  const [serverError, setServerError] = useState<string | null>(null);
  const supabase = useSupabaseBrowser();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!supabase) return;
    setServerError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError("メールアドレスまたはパスワードが正しくありません。");
      return;
    }
    const session = data.session;
    if (!session) {
      setServerError("ログインに失敗しました。メール認証をお済ませください。");
      return;
    }
    try {
      await syncAuthCookies(session.access_token, session.refresh_token);
    } catch {
      setServerError("セッションの保存に失敗しました。もう一度お試しください。");
      return;
    }
    const boot = await fetch("/api/profile/bootstrap", { method: "POST" });
    if (!boot.ok) {
      setServerError(
        "ログインはできましたがプロフィールの初期化に失敗しました。しばらくしてから再度ログインしてください。",
      );
      return;
    }
    router.push(nextPath.startsWith("/") ? nextPath : "/consultations");
    router.refresh();
  });

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">ログイン</CardTitle>
        <CardDescription>登録したメールアドレスとパスワードで入ります。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          {serverError ? (
            <Alert variant="destructive">
              <AlertTitle>ログインできませんでした</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="login-email">メールアドレス</Label>
            <Input
              id="login-email"
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="login-password">パスワード</Label>
              <Link
                href="/forgot-password"
                className="text-primary text-sm underline-offset-4 hover:underline"
              >
                忘れた場合
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
              disabled={form.formState.isSubmitting || !supabase}
            />
            {form.formState.errors.password ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

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
                : "ログイン"}
          </Button>

          <p className="text-muted-foreground text-center text-sm">
            はじめての方は{" "}
            <Link href="/register" className="text-primary font-medium underline-offset-4 hover:underline">
              新規登録
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
