"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import {
  useRouteTransition,
} from "@/components/navigation/RouteTransitionProvider";
import type { RouteTransitionSkeletonKind } from "@/components/navigation/RouteTransitionSkeleton";

type TransitionLinkProps = {
  href: Route;
  skeleton: RouteTransitionSkeletonKind;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
};

export default function TransitionLink({
  href,
  skeleton,
  className,
  children,
  prefetch,
}: TransitionLinkProps) {
  const pathname = usePathname();
  const { navigate } = useRouteTransition();
  const targetPath = href.split("?")[0];

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) {
      return;
    }

    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (pathname === targetPath) {
      return;
    }

    event.preventDefault();
    navigate({ href, skeleton });
  }

  return (
    <Link href={href} prefetch={prefetch} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
