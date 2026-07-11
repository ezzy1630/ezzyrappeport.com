import type { ComponentProps } from "react";
import Link from "next/link";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  transitionName?: string;
};

export default function ProjectTransitionLink({
  href,
  transitionName,
  style,
  children,
  ...props
}: Props) {
  return (
    <Link
      {...props}
      href={href}
      style={{ ...style, viewTransitionName: transitionName }}
    >
      {children}
    </Link>
  );
}
