"use client";

import { ArrowUpRight } from "lucide-react";
import { shouldInterceptChapterHashClick } from "@/features/ocean-experience/navigation/chapter-hash-click";
import { getActiveScrollDirector } from "@/features/ocean-experience/scroll/active-scroll-director";

export default function ContactRiseLink() {
  const handleRiseToSurface = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!shouldInterceptChapterHashClick(event, {
      target: event.currentTarget.target,
      download: event.currentTarget.download,
    })) return;
    event.preventDefault();
    const director = getActiveScrollDirector();
    if (director) director.seekChapter("surface");
    else window.scrollTo({ top: 0, behavior: "auto" });
    window.history.pushState(null, "", "#top");
  };

  return (
    <a
      className="contact-footer__top"
      href="#top"
      aria-label="Top. Rise back to the surface"
      data-liquid-hover
      data-magnetic="button"
      onClick={handleRiseToSurface}
    >
      Top <ArrowUpRight aria-hidden="true" />
    </a>
  );
}
