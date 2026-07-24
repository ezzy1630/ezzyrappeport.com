import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/portfolio/content";
import ProjectDetail from "./ProjectDetail";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) {
    return { title: "Not found | Ezzy Rappeport" };
  }
  return {
    title: `${project.title} | Ezzy Rappeport`,
    description: project.tagline,
    alternates: { canonical: `/project/${project.slug}` },
    openGraph: {
      title: `${project.title} | Ezzy Rappeport`,
      description: project.tagline,
      url: `/project/${project.slug}`,
      images: project.media.cover?.src ? [{ url: project.media.cover.src }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} | Ezzy Rappeport`,
      description: project.tagline,
      creator: "@ezzy1630",
      site: "@ezzy1630",
      images: project.media.cover?.src ? [project.media.cover.src] : undefined,
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: project.title,
    description: project.tagline,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    image: project.media.cover?.src
      ? `https://www.ezzyrappeport.com${project.media.cover.src}`
      : undefined,
    author: {
      "@type": "Person",
      name: "Ezzy Rappeport",
      url: "https://www.ezzyrappeport.com",
    },
    url: `https://www.ezzyrappeport.com/project/${project.slug}`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProjectDetail project={project} />
    </>
  );
}
