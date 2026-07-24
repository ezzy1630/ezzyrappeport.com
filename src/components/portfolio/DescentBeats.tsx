"use client";

import { useEffect } from "react";
import { createScrubBeat, initScrollChoreography } from "@/lib/portfolio/scroll-choreography";
import { unbindGsapFromFrameClock } from "@/lib/portfolio/frame-clock";
import { emitLiquidPress } from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy, subscribeMotionPolicy } from "@/lib/portfolio/motion-policy";

/**
 * DescentBeats — Phase 3 cinematic dive choreography
 * --------------------------------------------------
 * Short, releasable scrub windows (never long pins) that stage the descent:
 *  1. Projects band discovery (shared — per-row pins felt heavy)
 *  2. About calm pocket settle
 *  3. Contact / abyss floor arrival
 * Plus depth-synced section headline reveals.
 *
 * Lenis keeps scroll ownership. GSAP runs on the unified frame clock.
 */
export default function DescentBeats() {
  useEffect(() => {
    let disposed = false;
    let gsapBound = false;
    const cleanups: Array<() => void> = [];
    const root = document.documentElement;

    const motionAllowed = () => readMotionPolicy().choreographyAllowed;

    const revealInstant = () => {
      document.querySelectorAll<HTMLElement>("[data-section-reveal]").forEach((node) => {
        node.dataset.sectionReveal = "in";
      });
      root.style.setProperty("--descent-projects", "1");
      root.style.setProperty("--descent-about", "1");
      root.style.setProperty("--descent-contact", "1");
      root.dataset.abyssArrived = "true";
    };

    const bindReveals = () => {
      const nodes = [...document.querySelectorAll<HTMLElement>("[data-section-reveal]")];
      if (!motionAllowed()) {
        nodes.forEach((node) => {
          node.dataset.sectionReveal = "in";
        });
        return;
      }
      nodes.forEach((node) => {
        if (!node.dataset.sectionReveal || node.dataset.sectionReveal === "") {
          node.dataset.sectionReveal = "out";
        }
      });
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const node = entry.target as HTMLElement;
            if (entry.isIntersecting && entry.intersectionRatio >= 0.28) {
              node.dataset.sectionReveal = "in";
            }
          }
        },
        { threshold: [0.28, 0.45], rootMargin: "0px 0px -8% 0px" },
      );
      nodes.forEach((node) => observer.observe(node));
      cleanups.push(() => observer.disconnect());
    };

    const run = async () => {
      try {
        await initScrollChoreography();
      } catch (error) {
        console.warn("[portfolio] descent choreography init failed", error);
        if (!disposed) revealInstant();
        return;
      }
      if (disposed) {
        unbindGsapFromFrameClock();
        return;
      }
      gsapBound = true;

      if (!motionAllowed()) {
        revealInstant();
        return;
      }

      bindReveals();

      // Shared projects-band discovery — one short scrub, not per-row pins.
      const projects = document.getElementById("projects");
      if (projects) {
        let lastWake = 0;
        cleanups.push(
          createScrubBeat({
            trigger: projects,
            start: "top 78%",
            end: "top 18%",
            pin: false,
            onProgress: (progress) => {
              root.style.setProperty("--descent-projects", progress.toFixed(3));
              projects.dataset.discovery = progress > 0.12 ? "active" : "idle";
              const now = performance.now();
              // Soft wake once as the band opens — caustic pool already owns resolve.
              if (progress > 0.22 && progress < 0.48 && now - lastWake > 2400) {
                lastWake = now;
                const media = projects.querySelector<HTMLElement>("[data-project-media]");
                if (media) {
                  const rect = media.getBoundingClientRect();
                  emitLiquidPress({
                    x: rect.left + rect.width * 0.5,
                    y: rect.top + rect.height * 0.55,
                    strength: 0.16,
                    radius: 72,
                  });
                }
              }
            },
          }),
        );
      }

      const about = document.getElementById("about");
      if (about) {
        cleanups.push(
          createScrubBeat({
            trigger: about,
            start: "top 72%",
            end: "center center",
            pin: false,
            onProgress: (progress) => {
              root.style.setProperty("--descent-about", progress.toFixed(3));
              about.dataset.calmBeat = progress > 0.35 ? "settled" : "entering";
            },
          }),
        );
      }

      const contact = document.getElementById("contact");
      if (contact) {
        cleanups.push(
          createScrubBeat({
            trigger: contact,
            start: "top 85%",
            end: "top 28%",
            pin: false,
            onProgress: (progress) => {
              root.style.setProperty("--descent-contact", progress.toFixed(3));
              const arrived = progress > 0.55;
              root.dataset.abyssArrived = arrived ? "true" : "false";
              contact.dataset.abyss = arrived ? "floor" : "approach";
            },
          }),
        );
      }
    };

    void run();

    const onMotionChange = () => {
      if (!motionAllowed()) revealInstant();
    };
    const unsubscribePolicy = subscribeMotionPolicy(onMotionChange);

    return () => {
      disposed = true;
      unsubscribePolicy();
      cleanups.forEach((fn) => fn());
      if (gsapBound) unbindGsapFromFrameClock();
      root.style.removeProperty("--descent-projects");
      root.style.removeProperty("--descent-about");
      root.style.removeProperty("--descent-contact");
      delete root.dataset.abyssArrived;
    };
  }, []);

  return null;
}
