"use client";

import type { ComponentProps, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { navigateWithProjectTransition } from "@/lib/portfolio/project-transition";
import { usePortfolioMotion } from "./PortfolioMotionContext";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  transitionName?: string;
};

export default function ProjectTransitionLink({
  href,
  transitionName,
  onClick,
  style,
  target,
  children,
  ...props
}: Props) {
  const router = useRouter();
  const { motionEnabled } = usePortfolioMotion();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    navigateWithProjectTransition({
      motionEnabled,
      navigate: () => router.push(href),
    });
  };

  return (
    <Link
      {...props}
      href={href}
      target={target}
      onClick={handleClick}
      style={{ ...style, viewTransitionName: transitionName }}
    >
      {children}
    </Link>
  );
}
