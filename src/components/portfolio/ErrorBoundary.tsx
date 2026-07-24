"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = { hasError: boolean };

/**
 * ErrorBoundary
 * -------------
 * Catches render/lifecycle errors from costly WebGL children (FluidScene) so a
 * shader/context failure can't blank the whole page.
 * Note: it does NOT catch errors thrown inside requestAnimationFrame loops.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report safely — never throw from the boundary itself.
    try {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("[portfolio] render boundary", error.message, info.componentStack);
      }
    } catch {
      /* ignore reporting failures */
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
