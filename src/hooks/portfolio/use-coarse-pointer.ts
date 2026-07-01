"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether the user is on a touch-primary / coarse-pointer device.
 * Used to disable the custom cursor and heavy parallax on mobile.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return coarse;
}
