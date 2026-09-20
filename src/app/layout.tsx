import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
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
