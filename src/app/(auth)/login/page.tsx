import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

function LoginFormFallback() {
  return (
    <div className="bg-card ring-foreground/10 h-64 w-full animate-pulse rounded-xl ring-1" />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
