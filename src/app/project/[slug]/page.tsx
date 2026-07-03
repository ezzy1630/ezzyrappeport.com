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
    return { title: "Not found — Eliezer Rappeport" };
  }
  return {
    title: `${project.title} — Eliezer Rappeport`,
    description: project.tagline,
    openGraph: {
      title: `${project.title} — Eliezer Rappeport`,
      description: project.tagline,
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return notFound();

  return <ProjectDetail project={project} />;
}
