import Link from "next/link";

import { SITE_NAME } from "@/lib/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <p className="mb-6 text-center">
          <Link
            href="/"
            className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
          >
            ← {SITE_NAME} トップへ
          </Link>
        </p>
        {children}
      </div>
    </div>
  );
}
