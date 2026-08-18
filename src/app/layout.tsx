import type { Metadata, Viewport } from "next";

/*
 * Fonts are self-hosted via Fontsource (OFL licensed) rather than
 * next/font/google: no network fetch at build/dev time, deterministic CI.
 * Family names are wired to tokens in globals.css (--font-ui, --font-display).
 */
import "@fontsource/noto-sans-hebrew/400.css";
import "@fontsource/noto-sans-hebrew/500.css";
import "@fontsource/noto-sans-hebrew/700.css";
import "@fontsource/karantina/400.css";
import "@fontsource/karantina/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "רנצ'ו — תיקוני אופניים עד הבית",
  description: "פנצ'ר? תיקון? טיפול? שב בכייף, אנחנו בדרך.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
