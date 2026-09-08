"use client";

import { useEffect, useState } from "react";
import styles from "./Editorial.module.css";

type Section = { id: string; label: string };

export default function ChapterNavigation({ sections }: { sections: readonly Section[] }) {
  const [current, setCurrent] = useState(sections[0]?.id);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (entering[0]) setCurrent(entering[0].target.id);
    }, { rootMargin: "-15% 0px -60% 0px", threshold: 0 });
    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sections]);
  return <nav className={styles.chapterNavigation} aria-label="Case study chapters"><span>Inside the project</span>{sections.map((section, index) => <a key={section.id} href={`#${section.id}`} aria-current={current === section.id ? "location" : undefined}><small aria-hidden="true">0{index + 1}</small>{section.label}</a>)}</nav>;
}
