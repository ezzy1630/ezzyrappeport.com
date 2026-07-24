import type { MetadataRoute } from "next";
import { portfolioIdentity } from "@/lib/portfolio/identity";

export default function robots(): MetadataRoute.Robots {
  const base = portfolioIdentity.domain.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
