"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Mail } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import { createGeometryCache } from "@/lib/portfolio/geometry-cache";
import {
  emitLiquidPress,
  subscribeLiquidPointer,
} from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";
import { useLiquidPersistentSurface } from "@/hooks/portfolio/use-liquid-dialogue";

/**
 * Email slab + copy control — the interactive client island inside Contact.
 */
export default function ContactEmailSlab() {
  const emailRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  useLiquidPersistentSurface(emailRef, { phaseOffsetMs: 1540, strength: 0.16, radius: 54 });

  const copyEmail = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(bio.email);
      setCopied(true);
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  useEffect(() => {
    const slab = emailRef.current;
    if (!slab) return;
    let proximity = 0;
    let lastProximityPush = 0;
    let hovering = false;
    let disposed = false;
    const geometry = createGeometryCache(slab, { marginPx: 160 });

    const unsubscribe = subscribeLiquidPointer((pointer) => {
      if (disposed) return;
      if (!readMotionPolicy().effectsAllowed) {
        slab.style.setProperty("--slab-proximity", "0");
        return;
      }
      if (!geometry.isNearViewport()) return;
      const rect = geometry.getRect();
      if (!rect) return;

      const reach = Math.max(rect.width * 0.62, 320);
      const distance = Math.hypot(pointer.x - rect.cx, pointer.y - rect.cy);
      const target = pointer.active ? Math.max(0, 1 - distance / reach) : 0;
      proximity += (target - proximity) * 0.12;
      if (Math.abs(proximity - target) < 0.004) proximity = target;
      slab.style.setProperty("--slab-proximity", proximity.toFixed(3));
      const now = performance.now();
      if (readMotionPolicy().liquidAllowed && proximity > 0.45 && now - lastProximityPush > 1400) {
        lastProximityPush = now;
        emitLiquidPress({
          x: rect.cx,
          y: rect.bottom + 26,
          strength: 0.18 + proximity * 0.2,
          radius: 62,
        });
      }
    });

    const onEnter = () => {
      hovering = true;
      if (!readMotionPolicy().liquidAllowed) return;
      const rect = geometry.getRect() ?? (() => {
        const box = slab.getBoundingClientRect();
        return {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          right: box.right,
          bottom: box.bottom,
          cx: box.left + box.width * 0.5,
          cy: box.top + box.height * 0.5,
        };
      })();
      emitLiquidPress({
        x: rect.cx,
        y: rect.cy,
        strength: 0.42,
        radius: 74,
      });
    };
    const onLeave = () => {
      hovering = false;
      slab.style.setProperty("--slab-tilt-x", "0deg");
      slab.style.setProperty("--slab-tilt-y", "0deg");
      slab.style.setProperty("--slab-magnet-x", "0px");
      slab.style.setProperty("--slab-magnet-y", "0px");
      slab.style.willChange = "";
    };
    const onMove = (event: PointerEvent) => {
      if (!hovering || !readMotionPolicy().effectsAllowed) return;
      const rect = geometry.getRect();
      if (!rect) return;
      const nx = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      const ny = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      slab.style.willChange = "transform";
      slab.style.setProperty("--slab-tilt-x", `${(-ny * 2.4).toFixed(2)}deg`);
      slab.style.setProperty("--slab-tilt-y", `${(nx * 3.1).toFixed(2)}deg`);
      slab.style.setProperty("--slab-magnet-x", `${(nx * 10).toFixed(2)}px`);
      slab.style.setProperty("--slab-magnet-y", `${(ny * 7).toFixed(2)}px`);
    };

    slab.addEventListener("pointerenter", onEnter);
    slab.addEventListener("pointerleave", onLeave);
    slab.addEventListener("pointermove", onMove);

    return () => {
      disposed = true;
      unsubscribe();
      geometry.dispose();
      slab.removeEventListener("pointerenter", onEnter);
      slab.removeEventListener("pointerleave", onLeave);
      slab.removeEventListener("pointermove", onMove);
      slab.style.willChange = "";
    };
  }, []);

  return (
    <div className="contact-section__email-row">
      <div
        ref={emailRef}
        className="contact-section__email liquid-dialogue"
        data-liquid-hover
      >
        <a
          className="contact-section__email-main"
          href={`mailto:${bio.email}`}
          aria-label={`${bio.emailLabel}. Open email`}
        >
          <span className="contact-section__email-mark" aria-hidden="true">
            <Mail />
          </span>
          <span className="contact-section__email-copy">
            <span>{bio.emailLabel}</span>
          </span>
          <span className="contact-section__email-icon" aria-hidden="true">
            <ArrowUpRight />
          </span>
        </a>
        <button
          type="button"
          className="contact-section__copy"
          data-copied={copied ? "true" : "false"}
          data-liquid-hover
          data-magnetic="button"
          onClick={copyEmail}
          aria-label={copied ? `Copied ${bio.email}` : `Copy email address`}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span className="contact-section__copy-label">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}
