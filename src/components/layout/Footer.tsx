import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-border/80 mt-auto border-t py-8">
      <div className="text-muted-foreground mx-auto flex max-w-5xl flex-col gap-4 px-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>一人で抱え込まなくてよい場所でありたい、という想いで運営しています。</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/sponsors" className="hover:text-foreground underline-offset-4 hover:underline">
            もりみちスポンサー一覧
          </Link>
          <Link href="/terms" className="hover:text-foreground underline-offset-4 hover:underline">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-foreground underline-offset-4 hover:underline">
            プライバシー
          </Link>
          <Link href="/tokushoho" className="hover:text-foreground underline-offset-4 hover:underline">
            特定商取引法に基づく表記
          </Link>
        </div>
      </div>
    </footer>
  );
}
