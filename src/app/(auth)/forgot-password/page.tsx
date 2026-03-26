import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return <ForgotPasswordForm redirectOrigin={origin} />;
}
