import { projects } from "@/lib/portfolio/content";
import ChartedWork from "./ChartedWork";
import ProjectEncounter from "./ProjectEncounter";
import ProjectsInteraction from "./ProjectsInteraction";
import styles from "./ProjectsSection.module.css";

/**
 * Homepage journey order (plan §4): the four anchors as spatial encounters,
 * then the Charted Work catalog keeps Velox, NexaRad, MathPilot (and every
 * anchor) directly reachable. Facts and identity come from `content.ts`.
 */
const HOMEPAGE_ROW_ORDER = ["monkeyclaw", "etch", "flowe", "argyph"];
const homepageProjects = HOMEPAGE_ROW_ORDER.map((slug) => {
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing portfolio project: ${slug}`);
  return project;
});

/** First N entries carry full editorial weight; the rest scan as a compact index. */
const DOMINANT_COUNT = 3;

type ProjectWeight = "dominant" | "compact";

function padIndex(n: number): string {
  return String(n).padStart(2, "0");
}

function projectWeight(order: number): ProjectWeight {
  return order < DOMINANT_COUNT ? "dominant" : "compact";
}

export default function ProjectsSection() {
  const totalLabel = padIndex(projects.length);

  return (
    <section
      id="projects"
      className={styles.section}
      aria-labelledby="work-title"
      data-depth-band="shallow"
    >
      <header className={styles.header} data-section-reveal>
        <h2 id="work-title">Systems built to survive contact with reality.</h2>
        <p className={styles.intro}>
          A selected body of work across agent security, hardware, education,
          medical imaging, and code intelligence - presented with the evidence,
          constraints, and current state intact.
        </p>
      </header>

      <ol className={styles.index}>
        {homepageProjects.map((project, order) => {
          const weight = projectWeight(order);
          const progress = padIndex(order + 1);

          return (
            <li key={project.slug} data-weight={weight}>
              <ProjectEncounter
                project={project}
                progress={progress}
                total={totalLabel}
              />
            </li>
          );
        })}
        <li data-weight="dominant" className={styles.chartedItem}>
          <ChartedWork />
        </li>
      </ol>
      <ProjectsInteraction />
    </section>
  );
}
