import type { MetadataRoute } from "next";
import { projects } from "@/lib/portfolio/content";
import { portfolioIdentity } from "@/lib/portfolio/identity";

/** Stable lastModified — avoid build-time "now" churn in sitemap diffs. */
const SITE_LAST_MODIFIED = new Date("2026-07-01T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const base = portfolioIdentity.domain.replace(/\/$/, "");
  return [
    {
      url: `${base}/`,
      lastModified: SITE_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/resume`,
      lastModified: SITE_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...projects.map((project) => ({
      url: `${base}/project/${project.slug}`,
      lastModified: SITE_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
