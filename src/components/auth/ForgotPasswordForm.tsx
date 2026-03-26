"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";

type FormValues = z.infer<typeof forgotPasswordSchema>;

type Props = {
  redirectOrigin: string;
};

export function ForgotPasswordForm({ redirectOrigin }: Props) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const supabase = useSupabaseBrowser();

  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!supabase) return;
    setServerError(null);
    const redirectTo = `${redirectOrigin.replace(/\/$/, "")}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setDone(true);
  });

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">パスワードを再設定</CardTitle>
        <CardDescription>
          登録済みのメールアドレスに、再設定用のリンクをお送りします。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <Alert>
            <AlertTitle>メールを送信しました</AlertTitle>
            <AlertDescription>
              届かない場合は迷惑メールフォルダもご確認ください。しばらく経ってから
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                ログイン
              </Link>
              へお進みください。
            </AlertDescription>
          </Alert>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            {serverError ? (
              <Alert variant="destructive">
                <AlertTitle>送信できませんでした</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="forgot-email">メールアドレス</Label>
              <Input
                id="forgot-email"
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
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting || !supabase}
            >
              {!supabase
                ? "準備中…"
                : form.formState.isSubmitting
                  ? "送信中…"
                  : "リンクを送る"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                ログインに戻る
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
