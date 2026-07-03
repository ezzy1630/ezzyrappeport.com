"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = { hasError: boolean };

/**
 * ErrorBoundary
 * -------------
 * Catches render/lifecycle errors from costly WebGL children (FluidScene,
 * LiquidGlassCard) so a shader/context failure can't blank the whole page.
 * Note: it does NOT catch errors thrown inside requestAnimationFrame loops.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    // Swallow silently — the fallback UI keeps the page usable.
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
