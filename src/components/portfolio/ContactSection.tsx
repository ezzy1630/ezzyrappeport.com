"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Mail, MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import {
  emitLiquidPress,
  subscribeLiquidPointer,
} from "@/lib/portfolio/liquid-interaction";
import { useLiquidPersistentSurface } from "@/hooks/portfolio/use-liquid-dialogue";

/**
 * ContactSection — the ocean floor.
 * The email slab is a registered displacement surface inside the shared
 * water: approaching it lifts the slab and brightens its glass edges, direct
 * contact tilts it a bounded few degrees toward the cursor, and every touch
 * sends a real pulse through the same heightfield the hero name floats in.
 */
export default function ContactSection() {
  const emailRef = useRef<HTMLAnchorElement>(null);
  const locationRef = useRef<HTMLParagraphElement>(null);
  useLiquidPersistentSurface(emailRef, { phaseOffsetMs: 1540, strength: 0.16, radius: 54 });

  // Rising back to the surface retraces the same depth curve — the inverse
  // journey, not a jump.
  const handleRiseToSurface = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.history.replaceState(null, "", "#top");
  };

  useEffect(() => {
    const slab = emailRef.current;
    if (!slab) return;
    let proximity = 0;
    let lastProximityPush = 0;
    let hovering = false;
    let disposed = false;

    const unsubscribe = subscribeLiquidPointer((pointer) => {
      if (disposed) return;
      const rect = slab.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const reach = Math.max(rect.width * 0.62, 320);
      const distance = Math.hypot(pointer.x - cx, pointer.y - cy);
      const target = pointer.active ? Math.max(0, 1 - distance / reach) : 0;
      proximity += (target - proximity) * 0.12;
      if (Math.abs(proximity - target) < 0.004) proximity = target;
      slab.style.setProperty("--slab-proximity", proximity.toFixed(3));
      // The slab displaces the water it rests in: gentle presses while the
      // pointer closes in, so the caustic pool answers before contact.
      const now = performance.now();
      if (proximity > 0.45 && now - lastProximityPush > 1400) {
        lastProximityPush = now;
        emitLiquidPress({
          x: cx,
          y: rect.bottom + 26,
          strength: 0.18 + proximity * 0.2,
          radius: 62,
        });
      }
    });

    const onEnter = () => {
      hovering = true;
      const rect = slab.getBoundingClientRect();
      emitLiquidPress({
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
        strength: 0.42,
        radius: 74,
      });
    };
    const onLeave = () => {
      hovering = false;
      slab.style.setProperty("--slab-tilt-x", "0deg");
      slab.style.setProperty("--slab-tilt-y", "0deg");
    };
    const onMove = (event: PointerEvent) => {
      if (!hovering) return;
      const rect = slab.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      const ny = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      // A bounded, expensive-feeling tilt — never a wobble.
      slab.style.setProperty("--slab-tilt-x", `${(-ny * 2.4).toFixed(2)}deg`);
      slab.style.setProperty("--slab-tilt-y", `${(nx * 3.1).toFixed(2)}deg`);
    };

    slab.addEventListener("pointerenter", onEnter);
    slab.addEventListener("pointerleave", onLeave);
    slab.addEventListener("pointermove", onMove);

    const location = locationRef.current;
    const onLocationTouch = () => {
      if (!location) return;
      const rect = location.getBoundingClientRect();
      emitLiquidPress({
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
        strength: 0.3,
        radius: 46,
      });
    };
    location?.addEventListener("pointerenter", onLocationTouch);

    return () => {
      disposed = true;
      unsubscribe();
      slab.removeEventListener("pointerenter", onEnter);
      slab.removeEventListener("pointerleave", onLeave);
      slab.removeEventListener("pointermove", onMove);
      location?.removeEventListener("pointerenter", onLocationTouch);
    };
  }, []);

  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title">

      <div className="contact-section__inner">
        <div className="contact-basin">
          <div className="contact-basin__copy">
            <p className="contact-section__eyebrow">Contact</p>
            <h2 id="contact-title">
              <span>Let’s build something</span>
              <span>that matters.</span>
            </h2>
            <p className="contact-section__intro">
              I’m always open to discussing AI systems, developer tools,
              product software, or founder work that makes an impact.
            </p>
          </div>
          <a
            ref={emailRef}
            className="contact-section__email liquid-dialogue"
            href={`mailto:${bio.email}`}
            data-liquid-hover
            aria-label={`Start a conversation with ${bio.name} by email`}
          >
            <span className="contact-section__email-mark" aria-hidden="true">
              <Mail />
            </span>
            <span className="contact-section__email-copy">
              <span>{bio.email}</span>
            </span>
            <span className="contact-section__email-icon" aria-hidden="true">
              <ArrowUpRight />
            </span>
          </a>
          <p ref={locationRef} className="contact-section__location">
            <MapPin aria-hidden="true" />
            {bio.location.title}
          </p>
        </div>

        <footer className="contact-footer">
          <p>
            <strong>{bio.name}</strong>
            <span>{bio.location.subtitle}</span>
          </p>
          <nav aria-label="Social links">
            {bio.socials.filter((social) => social.label !== "Email").map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {social.label}<ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </nav>
          <p className="contact-footer__meta">
            <span>© {new Date().getFullYear()}</span>
            <span>Designed &amp; engineered in California</span>
          </p>
          <a
            className="contact-footer__top"
            href="#top"
            aria-label="Rise back to the surface"
            onClick={handleRiseToSurface}
          >
            Top <ArrowUpRight aria-hidden="true" />
          </a>
        </footer>
      </div>
    </section>
  );
}
