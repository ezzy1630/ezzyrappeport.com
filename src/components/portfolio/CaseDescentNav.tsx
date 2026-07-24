"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProjectTransitionLink, {
  navigateWithDive,
} from "@/components/portfolio/ProjectTransitionLink";
import styles from "../../app/project/[slug]/ProjectDetail.module.css";

type Neighbor = {
  slug: string;
  title: string;
  tagline: string;
};

type Props = {
  previous: Neighbor;
  next: Neighbor;
};

export default function CaseDescentNav({ previous, next }: Props) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateWithDive(router, `/project/${previous.slug}`, "back");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateWithDive(router, `/project/${next.slug}`, "forward");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next.slug, previous.slug, router]);

  const prefetchNeighbor = (slug: string) => {
    router.prefetch(`/project/${slug}`);
  };

  return (
    <>
      <nav className={styles.nextBleed} aria-label="Next project">
        <ProjectTransitionLink
          href={`/project/${next.slug}`}
          className={styles.nextBleedLink}
          transitionName={`project-${next.slug}`}
          data-magnetic="button"
          onPointerEnter={() => prefetchNeighbor(next.slug)}
          onFocus={() => prefetchNeighbor(next.slug)}
        >
          <span className={styles.nextBleedLabel} data-magnetic-stack>
            <small>Continue the dive</small>
            <strong data-magnetic-label>{next.title}</strong>
            <span>{next.tagline}</span>
            <em className={styles.nextBleedHint}>
              Next project
              <span className={styles.nextBleedArrow} aria-hidden="true">→</span>
            </em>
          </span>
        </ProjectTransitionLink>
      </nav>

      <nav className={styles.pagination} aria-label="Project navigation">
        <ProjectTransitionLink
          href={`/project/${previous.slug}`}
          transitionDirection="back"
          onPointerEnter={() => prefetchNeighbor(previous.slug)}
          onFocus={() => prefetchNeighbor(previous.slug)}
        >
          <small>Previous · ←</small>
          <strong>{previous.title}</strong>
        </ProjectTransitionLink>
        <ProjectTransitionLink
          href={`/project/${next.slug}`}
          onPointerEnter={() => prefetchNeighbor(next.slug)}
          onFocus={() => prefetchNeighbor(next.slug)}
        >
          <small>Next · →</small>
          <strong>{next.title}</strong>
        </ProjectTransitionLink>
      </nav>
    </>
  );
}
