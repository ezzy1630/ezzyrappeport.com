import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ArrowDown, MapPin } from "lucide-react";
import { bio, projects } from "@/lib/portfolio/content";
import WaterHero from "../water-study/WaterHero";
import { additionalWork, featuredPresentation } from "./catalog";
import styles from "./Portfolio.module.css";

const featuredSlugs = ["monkeyclaw", "flowe", "etch", "argyph"] as const;
const featured = featuredSlugs.flatMap((slug) => {
  const project = projects.find((entry) => entry.slug === slug);
  return project ? [{ project, presentation: featuredPresentation[slug] }] : [];
});
const featuredSlugSet = new Set<string>(featuredSlugs);
const otherProjects = projects.filter(
  (project) => !featuredSlugSet.has(project.slug),
);

export default function Portfolio() {
  return (
    <div className={styles.portfolio} id="top" data-water-world>
      <a className={styles.skip} href="#projects">
        Skip to projects
      </a>
      <header className={styles.navigation}>
        <a
          className={styles.identity}
          href="#top"
          aria-label="Ezzy Rappeport, home"
        >
          <Image
            src="/assets/ezzy-headshot.jpg"
            alt=""
            width={44}
            height={44}
            priority
          />
          <span>EZZY RAPPEPORT</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#projects">Projects</a>
          <a href="#about">About</a>
        </nav>
        <a className={styles.contactLink} href={`mailto:${bio.email}`}>
          Get in touch <ArrowUpRight size={17} />
        </a>
      </header>
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="portfolio-title">
          <WaterHero />
          <h1 id="portfolio-title" className="sr-only">
            Ezzy Rappeport
          </h1>
          <div className={styles.heroBottom}>
            <div>
              <p className={styles.roles}>
                Software Engineer <span>/</span> <strong>AI Systems</strong>{" "}
                <span>/</span> Founder
              </p>
              <p className={styles.intro}>{bio.heroSentence}</p>
              <a className={styles.primary} href="#projects">
                Explore work <ArrowUpRight size={18} />
              </a>
            </div>
            <p className={styles.location}>
              <MapPin size={23} /> Based in California
            </p>
          </div>
          <a
            className={styles.scroll}
            href="#projects"
            aria-label="Scroll to projects"
          >
            <ArrowDown size={20} />
          </a>
        </section>
        <section
          id="projects"
          tabIndex={-1}
          className={styles.work}
          aria-labelledby="work-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>01 / SELECTED WORK</p>
              <h2 id="work-title">Ideas, made real.</h2>
            </div>
            <p>
              AI systems, developer tools,
              <br />
              and things I wanted to exist.
            </p>
          </div>
          <div className={styles.projectGrid}>
            {featured.map(({ project, presentation }, index) => (
              <Link
                prefetch={false}
                key={project.slug}
                href={`/project/${project.slug}`}
                className={styles.project}
                data-water-surface
                aria-labelledby={`${project.slug}-title`}
              >
                <div
                  className={styles.projectVisual}
                  data-project={project.slug}
                >
                  <Image
                    src={presentation.cover}
                    alt={presentation.alt}
                    fill
                    sizes="(max-width: 600px) 88vw, (max-width: 1440px) 44vw, 620px"
                  />
                  <span className={styles.mediaLabel}>
                    {presentation.mediaLabel}
                  </span>
                  <span className={styles.openProject} aria-hidden="true">
                    <ArrowUpRight size={22} />
                  </span>
                </div>
                <div className={styles.projectHeading}>
                  <h3 id={`${project.slug}-title`}>{project.title}</h3>
                  <span aria-hidden="true">0{index + 1}</span>
                </div>
                <p>{presentation.purpose}</p>
                <p className={styles.projectResult}>{presentation.delivered}</p>
                <div className={styles.projectMeta}>
                  <span>{project.role}</span>
                  <span className={styles.readCase}>
                    View case study{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className={styles.latestHeading}>
            <h3>From my workbench</h3>
            <p>More software I’m building in the open.</p>
          </div>
          <div className={styles.spotlights}>
            {additionalWork.slice(0, 2).map((project, i) => (
              <a
                key={project.name}
                className={styles.spotlight}
                data-water-surface
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className={styles.spotlightTop}>
                  <span>
                    {i === 0 ? "NATIVE MAC SOFTWARE" : "BUILDING IN THE OPEN"}
                  </span>
                  <ArrowUpRight size={25} />
                </div>
                <h3>
                  {project.name}
                  <span>{i === 0 ? "↓" : "_"}</span>
                </h3>
                <p>{project.description}</p>
                <div className={styles.spotlightBottom}>
                  <small>{project.category}</small>
                  <span>
                    {project.name === "Downright"
                      ? "Visit site"
                      : "Explore source"}{" "}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </a>
            ))}
          </div>
          <div className={styles.moreHeading}>
            <h3>More things I’ve built</h3>
            <a
              href="https://github.com/ezzy1630"
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore GitHub <ArrowUpRight size={16} />
            </a>
          </div>
          <div className={styles.catalog}>
            {otherProjects.map((project) => (
              <Link
                prefetch={false}
                href={`/project/${project.slug}`}
                key={project.slug}
                data-water-surface
              >
                <h4>{project.title}</h4>
                <p>{project.tagline}</p>
                <ArrowUpRight size={20} />
              </Link>
            ))}
            {additionalWork.slice(2).map((project) => (
              <a
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
                key={project.name}
                data-water-surface
              >
                <h4>
                  {project.name}
                  <small>{project.category.split(" · ")[1]}</small>
                </h4>
                <p>{project.description}</p>
                <ArrowUpRight size={20} />
              </a>
            ))}
          </div>
        </section>
        <section
          id="about"
          className={styles.about}
          aria-labelledby="about-title"
        >
          <div>
            <p className={styles.eyebrow}>02 / A LITTLE ABOUT ME</p>
            <h2 id="about-title">
              Curiosity.
              <br />
              Then code.
            </h2>
            <Image
              src="/assets/ezzy-headshot.jpg"
              alt="Ezzy Rappeport"
              width={120}
              height={120}
            />
          </div>
          <div className={styles.aboutCopy}>
            <p>{bio.bodyParagraphs[0]}</p>
            <p>{bio.bodyParagraphs[1]}</p>
            <p>{bio.bodyParagraphs[2]}</p>
            <a href="/resume.pdf" target="_blank" rel="noopener noreferrer">
              View résumé <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <footer id="contact" className={styles.footer}>
          <p className={styles.eyebrow}>HAVE SOMETHING IN MIND?</p>
          <a className={styles.hello} href={`mailto:${bio.email}`}>
            Let’s make it happen.
            <ArrowUpRight />
          </a>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Ezzy Rappeport</span>
            <div>
              {bio.socials
                .filter((s) => ["GitHub", "LinkedIn", "X"].includes(s.label))
                .map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.label}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
            </div>
            <a href="#top">Back to surface ↑</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
