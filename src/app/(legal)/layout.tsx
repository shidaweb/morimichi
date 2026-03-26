import { AppShell } from "@/components/layout/AppShell";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
