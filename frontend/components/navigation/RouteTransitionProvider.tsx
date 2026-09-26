"use client";

import type { Route } from "next";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import RouteTransitionSkeleton, {
  type RouteTransitionSkeletonKind,
} from "@/components/navigation/RouteTransitionSkeleton";

type TransitionTarget = {
  href: Route;
  skeleton: RouteTransitionSkeletonKind;
};

type RouteTransitionContextValue = {
  navigate: (target: TransitionTarget) => void;
};

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null);

export default function RouteTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<TransitionTarget | null>(null);
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (target: TransitionTarget) => {
      setPendingTarget(target);
      startTransition(() => {
        router.push(target.href);
      });
    },
    [router]
  );

  useEffect(() => {
    if (!isPending && pendingTarget) {
      setPendingTarget(null);
    }
  }, [isPending, pendingTarget]);

  const value = useMemo(
    () => ({
      navigate,
    }),
    [navigate]
  );

  return (
    <RouteTransitionContext.Provider value={value}>
      {children}
      {pendingTarget ? (
        <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
          <RouteTransitionSkeleton variant={pendingTarget.skeleton} />
        </div>
      ) : null}
    </RouteTransitionContext.Provider>
  );
}

export function useRouteTransition() {
  const context = useContext(RouteTransitionContext);

  if (!context) {
    throw new Error("useRouteTransition must be used within RouteTransitionProvider");
  }

  return context;
}
