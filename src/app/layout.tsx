import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { portfolioIdentity } from "@/lib/portfolio/identity";
import "./globals.css";
import "./revamp.css";

const geistMono = localFont({
  src: "../../public/fonts/geist-mono/GeistMono-Latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
});

const generalSans = localFont({
  src: [
    {
      path: "../../public/fonts/general-sans/GeneralSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/general-sans/GeneralSans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/general-sans/GeneralSans-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-general-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  metadataBase: new URL(portfolioIdentity.domain),
  title: "Ezzy Rappeport - Software Engineer • AI Systems • Founder",
  description:
    "Multi-agent systems, humane AI, and tools that compound impact. Building from Los Angeles and Santa Cruz.",
  keywords: ["Ezzy Rappeport", "AI", "multi-agent", "software engineer", "founder", "portfolio"],
  authors: [{ name: "Ezzy Rappeport" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Ezzy Rappeport - Software Engineer • AI Systems • Founder",
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
    creator: "@ezzy1630",
    site: "@ezzy1630",
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
        className={`${geistMono.variable} ${generalSans.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: portfolioIdentity.name,
              url: portfolioIdentity.domain,
              email: portfolioIdentity.email,
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
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(typeof console!=="undefined"&&console.log){console.log("%cEzzy Rappeport","font-weight:700;font-size:14px;color:#0066ff");console.log("You found the deep end. The water is custom WebGL2. Dive into /project/monkeyclaw or hold Keep diving at the floor.");}}catch(e){}`,
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
