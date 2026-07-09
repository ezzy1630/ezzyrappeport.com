import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";
import "./revamp.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://eliezerrappeport.com"),
  title: "Eliezer Rappeport — Engineer • AI Builder • Founder",
  description:
    "Multi-agent systems, humane AI, and tools that compound impact. Building from Los Angeles and Santa Cruz.",
  keywords: ["Eliezer Rappeport", "AI", "multi-agent", "engineer", "founder", "portfolio"],
  authors: [{ name: "Eliezer Rappeport" }],
  openGraph: {
    title: "Eliezer Rappeport — Engineer • AI Builder • Founder",
    description:
      "Multi-agent systems, humane AI, and tools that compound impact. Building from Los Angeles and Santa Cruz.",
    type: "website",
    siteName: "Eliezer Rappeport",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eliezer Rappeport",
    description: "Engineer • AI Builder • Founder",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f9fc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} ${interTight.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
