import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-24 sm:px-6 md:pb-10">
        {children}
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
