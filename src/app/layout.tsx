import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = localFont({
  src: "../../public/fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
});

const sora = localFont({
  src: "../../public/fonts/sora-latin.woff2",
  variable: "--font-sora",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: {
    template: "%s | hisaabकिताब",
    default: "hisaabकिताब",
  },
  description: "Accounts-payable exception management for faster, evidence-based Finance review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable}`}
    >
      <body className="font-sans bg-canvas text-text-primary antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
