"use client";

import { useEffect, useState } from "react";

const MINIMUM_DISPLAY_MS = 520;
const FAIL_OPEN_MS = 5200;

export default function LoadingVeil() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    let dismissalTimer = 0;

    const finish = () => {
      const remaining = Math.max(0, MINIMUM_DISPLAY_MS - (performance.now() - startedAt));
      window.clearTimeout(dismissalTimer);
      dismissalTimer = window.setTimeout(() => setReady(true), remaining);
    };

    const failOpenTimer = window.setTimeout(finish, FAIL_OPEN_MS);
    if (document.documentElement.dataset.heroRenderer === "ready") finish();
    window.addEventListener("liquid-renderer-ready", finish, { once: true });

    return () => {
      window.clearTimeout(failOpenTimer);
      window.clearTimeout(dismissalTimer);
      window.removeEventListener("liquid-renderer-ready", finish);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => setDismissed(true), 760);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (dismissed) return null;

  return (
    <div className="loading-veil" data-ready={ready ? "true" : "false"} aria-hidden="true">
      <span className="loading-veil__line" />
    </div>
  );
}
