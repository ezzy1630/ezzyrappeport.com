"use client";

import type { Project } from "@/lib/portfolio/content";
import ProjectButtonsRow from "./ProjectButtonsRow";

type Props = {
  onProjectSelect?: (project: Project) => void;
};

export default function ProjectGrid({ onProjectSelect }: Props) {
  return <ProjectButtonsRow onProjectSelect={onProjectSelect} />;
}
