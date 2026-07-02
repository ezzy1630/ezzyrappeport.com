"use client";

import dynamic from "next/dynamic";
import { LayoutGroup } from "framer-motion";
import { useCallback, useState } from "react";
import { projects, type Project } from "@/lib/portfolio/content";
import ProjectCard from "./ProjectCard";

const ProjectModal = dynamic(() => import("./ProjectModal"));

export default function ProjectGrid() {
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const openProject = useCallback((project: Project) => {
    setActiveProject(project);
  }, []);

  const closeProject = useCallback(() => {
    setActiveProject(null);
  }, []);

  return (
    <LayoutGroup id="project-capsules">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7 lg:grid-cols-4">
        {projects.map((project, i) => (
          <ProjectCard
            key={project.slug}
            project={project}
            index={i}
            onOpen={openProject}
          />
        ))}
      </div>

      <ProjectModal project={activeProject} onClose={closeProject} />
    </LayoutGroup>
  );
}
