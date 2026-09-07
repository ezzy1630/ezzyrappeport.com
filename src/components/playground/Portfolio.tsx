import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ArrowDown, MapPin } from "lucide-react";
import { bio, projects } from "@/lib/portfolio/content";
import WaterHero from "../water-study/WaterHero";
import { additionalWork, featuredPresentation, featuredSlugs } from "./catalog";
import styles from "./Portfolio.module.css";

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
      <WaterHero />
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
        <section className={styles.hero} aria-labelledby="portfolio-title" data-water-hero>
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
              <h2 id="work-title">Selected projects.</h2>
            </div>
            <p>
              AI systems, developer tools,
              <br />
              built from the interface down.
              <span className={styles.interactionHint}>Drag the artwork. Explore the case study.</span>
            </p>
          </div>
          <div className={styles.projectGrid}>
            {featured.map(({ project, presentation }, index) => (
              <article
                key={project.slug}
                className={styles.project}
                data-depth={index % 2 === 0 ? "near" : "far"}
                aria-labelledby={`${project.slug}-title`}
              >
                <Link
                  href={`/project/${project.slug}`}
                  className={styles.projectVisual}
                  data-project={project.slug}
                  data-water-surface
                  data-water-featured
                  data-depth={index % 2 === 0 ? "near" : "far"}
                  aria-label={`Explore ${project.title}`}
                >
                  <Image
                    src={presentation.cover}
                    alt={presentation.alt}
                    quality={90}
                    fill
                    sizes="(max-width: 800px) 46vw, 30vw"
                  />
                </Link>
                <div className={styles.projectCopy}>
                  <p className={styles.projectKind}>{presentation.mediaLabel}</p>
                  <div className={styles.projectHeading}>
                    <h3 id={`${project.slug}-title`}><Link href={`/project/${project.slug}`}>{project.title}</Link></h3>
                    <span aria-hidden="true">0{index + 1}</span>
                  </div>
                  <p>{presentation.purpose}</p>
                  <p className={styles.projectResult}>{presentation.delivered}</p>
                  <div className={styles.projectMeta}>
                    <span>{project.role}</span>
                    <Link className={styles.readCase} href={`/project/${project.slug}`}>
                      View project{" "}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
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
                href={`/project/${project.slug}`}
                key={project.slug}
              >
                <h4>{project.title}</h4>
                <p>{project.tagline}</p>
                <ArrowUpRight size={20} />
              </Link>
            ))}
            {additionalWork.map((project) => (
              <a
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
                key={project.name}
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
            <a href="/resume">
              View résumé <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <footer id="contact" className={styles.footer}>
          <div className={styles.contactOpening}>
          <p className={styles.eyebrow}>HAVE SOMETHING IN MIND?</p>
          <a className={styles.hello} href={`mailto:${bio.email}`}>
            Let’s make it happen.
            <ArrowUpRight />
          </a>
          <a className={styles.email} href={`mailto:${bio.email}`}>{bio.email}</a>
          </div>
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
