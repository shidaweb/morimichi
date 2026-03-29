import type { Metadata } from "next";

import "./globals.css";

import { SITE_NAME } from "@/lib/constants";

const SITE_TITLE_DEFAULT = `${SITE_NAME} — 早期事業再生コミュニティ`;

export const metadata: Metadata = {
  metadataBase: new URL("https://morimichi.cc"),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "経営がしんどい時、匿名で相談できる場所。経験者・専門家が回答します。",
  openGraph: {
    siteName: SITE_NAME,
    locale: "ja_JP",
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="bg-background text-foreground min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
