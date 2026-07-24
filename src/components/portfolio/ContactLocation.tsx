"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import { emitLiquidPress } from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";

/** Location line with a one-shot press on pointer enter. */
export default function ContactLocation() {
  const locationRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const location = locationRef.current;
    if (!location) return;
    const onLocationTouch = () => {
      if (!readMotionPolicy().liquidAllowed) return;
      const rect = location.getBoundingClientRect();
      emitLiquidPress({
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
        strength: 0.3,
        radius: 46,
      });
    };
    location.addEventListener("pointerenter", onLocationTouch);
    return () => location.removeEventListener("pointerenter", onLocationTouch);
  }, []);

  return (
    <p ref={locationRef} className="contact-section__location">
      <MapPin aria-hidden="true" />
      {bio.location.title}
    </p>
  );
}
