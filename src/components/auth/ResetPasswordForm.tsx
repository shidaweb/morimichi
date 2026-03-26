"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncAuthCookies } from "@/lib/auth/sync-session";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";
import { z } from "zod";

type FormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [ready, setReady] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) {
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!supabase) return;
    setServerError(null);
    const { data, error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    const session = data.user ? (await supabase.auth.getSession()).data.session : null;
    if (session) {
      try {
        await syncAuthCookies(session.access_token, session.refresh_token);
      } catch {
        setServerError("セッションの保存に失敗しました。ログインし直してください。");
        return;
      }
    }
    router.push("/mypage");
    router.refresh();
  });

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">新しいパスワード</CardTitle>
        <CardDescription>メールのリンクから開いたあと、ここで設定できます。</CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <Alert>
            <AlertTitle>リンクを確認しています</AlertTitle>
            <AlertDescription>
              このままお待ちください。開けない場合は、メールのリンクから再度アクセスしてください。
            </AlertDescription>
          </Alert>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            {serverError ? (
              <Alert variant="destructive">
                <AlertTitle>更新できませんでした</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="new-password">新しいパスワード（8文字以上）</Label>
              <Input
                id="new-password"
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
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting || !supabase}
            >
              {!supabase
                ? "準備中…"
                : form.formState.isSubmitting
                  ? "更新中…"
                  : "パスワードを更新"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                ログインへ
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
