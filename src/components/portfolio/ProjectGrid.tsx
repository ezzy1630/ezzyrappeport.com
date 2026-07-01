"use client";

import { motion } from "framer-motion";
import { projects } from "@/lib/portfolio/content";
import ProjectCard from "./ProjectCard";

/**
 * ProjectGrid
 * -----------
 * The 4-card row of featured project liquid blobs.
 * On desktop: 4 horizontal cards spanning almost full width.
 * On tablet: 2x2 grid.
 * On mobile: 1 column stacked.
 */
export default function ProjectGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
      {projects.map((project, i) => (
        <ProjectCard key={project.slug} project={project} index={i} />
      ))}
    </div>
  );
}

void motion;
