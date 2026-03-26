import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";

import "./globals.css";

import { SITE_NAME } from "@/lib/constants";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "経営のしんどさを匿名で相談し、経験者の声に触れられるコミュニティ（MVP）。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
