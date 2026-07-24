"use client";

import { ArrowUpRight } from "lucide-react";

export default function ContactRiseLink() {
  const handleRiseToSurface = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.history.replaceState(null, "", "#top");
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
