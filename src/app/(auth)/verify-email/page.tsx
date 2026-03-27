import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">メールを確認してください</CardTitle>
        <CardDescription>
          届いたメール内のリンクを開くと、登録が完了します。数分経っても届かない場合は、迷惑メールフォルダもご確認ください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm leading-relaxed">
          登録後すぐにログインできる設定の場合は、トップから「相談一覧」や「マイページ」へ進めます。
        </p>
        <div className="mt-4">
          <VerifyEmailClient />
        </div>
      </CardContent>
    </Card>
  );
}
