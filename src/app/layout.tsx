import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { portfolioIdentity } from "@/lib/portfolio/identity";
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
  metadataBase: new URL(portfolioIdentity.domain),
  title: "Ezzy Rappeport | Software Engineer, AI Systems, Founder",
  description:
    "Multi-agent systems, humane AI, and tools that compound impact. Building from Los Angeles and Santa Cruz.",
  keywords: ["Ezzy Rappeport", "AI", "multi-agent", "software engineer", "founder", "portfolio"],
  authors: [{ name: "Ezzy Rappeport" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Ezzy Rappeport | Software Engineer, AI Systems, Founder",
    description:
      "Multi-agent systems, humane AI, and tools that compound impact. Building from Los Angeles and Santa Cruz.",
    type: "website",
    siteName: "Ezzy Rappeport",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ezzy Rappeport",
    description: "Software Engineer • AI Systems • Founder",
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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} ${interTight.variable} antialiased bg-background text-foreground`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: portfolioIdentity.name,
              url: portfolioIdentity.domain,
              email: `mailto:${portfolioIdentity.email}`,
              jobTitle: portfolioIdentity.role,
              sameAs: [
                "https://github.com/ezzy1630",
                "https://linkedin.com/in/ezzy-rappeport",
                "https://x.com/ezzy1630",
                "https://instagram.com/ezzy1630",
              ],
            }),
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
