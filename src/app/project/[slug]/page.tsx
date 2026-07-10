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
    return { title: "Not found — Ezzy Rappeport" };
  }
  return {
    title: `${project.title} — Ezzy Rappeport`,
    description: project.tagline,
    alternates: { canonical: `/project/${project.slug}` },
    openGraph: {
      title: `${project.title} — Ezzy Rappeport`,
      description: project.tagline,
      url: `/project/${project.slug}`,
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return notFound();

  return <ProjectDetail project={project} />;
}
