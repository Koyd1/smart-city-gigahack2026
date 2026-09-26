import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type RouteTransitionSkeletonKind = "home" | "chat";

function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return <div className={cn("animate-pulse rounded-full bg-[#e8edf7]", className)} />;
}

function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-border bg-white p-8 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.55)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function SkeletonPreviewCard({
  titleWidth,
}: {
  titleWidth: string;
}) {
  return (
    <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.24)] sm:px-5">
      <div className="space-y-3">
        <SkeletonBlock className={cn("h-4 rounded-full bg-[#dfe7fb]", titleWidth)} />
        <SkeletonBlock className="h-3.5 w-full rounded-full bg-[#eaf0fd]" />
        <SkeletonBlock className="h-3.5 w-[88%] rounded-full bg-[#eaf0fd]" />
        <SkeletonBlock className="h-3.5 w-[72%] rounded-full bg-[#eaf0fd]" />
      </div>
    </div>
  );
}

function SkeletonHeader({
  showUserActions,
}: {
  showUserActions?: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 animate-pulse rounded-[14px] bg-[#e4f4fc]" />
        <SkeletonBlock className="h-8 w-28 rounded-[12px]" />
      </div>

      {showUserActions ? (
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-6 w-28 rounded-md" />
          <SkeletonBlock className="h-10 w-28 rounded-full" />
          <SkeletonBlock className="h-10 w-[88px] rounded-full" />
          <SkeletonBlock className="h-10 w-10 rounded-full bg-[#d9e2f0]" />
        </div>
      ) : (
        <SkeletonBlock className="h-10 w-10 rounded-full bg-[#d9e2f0]" />
      )}
    </header>
  );
}

function HomeTransitionSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-screen bg-page">
      <SkeletonHeader />

      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="pb-12 pt-16 text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-[104px] w-[104px] animate-pulse rounded-[30px] bg-[#e4f4fc]" />
          </div>

          <div className="mx-auto max-w-[760px] space-y-4">
            <SkeletonBlock className="mx-auto h-14 w-full max-w-[520px] rounded-[18px] bg-[#dfe7f5]" />
            <SkeletonBlock className="mx-auto h-6 w-full max-w-[640px] rounded-[14px]" />
            <SkeletonBlock className="mx-auto h-6 w-full max-w-[560px] rounded-[14px]" />
          </div>

          <div className="mx-auto mt-12 grid max-w-[820px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-8">
            {Array.from({ length: 2 }).map((_, index) => (
              <SkeletonCard key={index} className="text-left">
                <div className="space-y-5">
                  <div className="inline-flex h-11 w-11 animate-pulse rounded-[14px] bg-[#e4f4fc]" />
                  <div className="space-y-3">
                    <SkeletonBlock className="h-8 w-[220px] rounded-[14px] bg-[#dfe7f5]" />
                    <SkeletonBlock className="h-5 w-full rounded-[12px]" />
                    <SkeletonBlock className="h-5 w-11/12 rounded-[12px]" />
                    <SkeletonBlock className="h-5 w-3/4 rounded-[12px]" />
                  </div>
                </div>
                <SkeletonBlock className="mt-10 h-12 w-full rounded-full bg-[#f5c694]" />
              </SkeletonCard>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function ChatTransitionSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-screen bg-page">
      <SkeletonHeader showUserActions />

      <main className="mx-auto max-w-[1320px] overflow-hidden px-6 py-6">
        <div className="relative flex min-h-[calc(100vh-88px)] flex-col">
          <div className="pointer-events-none absolute -left-24 top-52 h-[360px] w-[360px] rounded-full bg-[#fde7b2] blur-[95px]" />
          <div className="pointer-events-none absolute -right-20 top-28 h-[380px] w-[380px] rounded-full bg-[#e2efff] blur-[105px]" />
          <div className="pointer-events-none absolute left-1/2 top-[56%] h-[280px] w-[520px] -translate-x-1/2 rounded-full bg-white/80 blur-[120px]" />

          <div className="relative mx-auto flex w-full max-w-[1080px] flex-1 flex-col items-center pb-4 pt-1">
            <div className="w-full">
              <SkeletonBlock className="h-9 w-28 rounded-[16px] bg-white shadow-[0_14px_34px_-28px_rgba(15,23,42,0.22)]" />
            </div>

            <div className="flex w-full flex-1 flex-col items-center justify-center gap-12 py-12 sm:gap-14 sm:py-16">
              <div className="w-full space-y-5 text-center">
                <SkeletonBlock className="mx-auto h-11 w-full max-w-[570px] rounded-full bg-[#f7cf9a] shadow-[0_14px_34px_-24px_rgba(242,140,40,0.5)]" />
                <SkeletonBlock className="mx-auto h-7 w-full max-w-[320px] rounded-full bg-[#f8dcba]" />
              </div>

              <div className="w-full max-w-[880px] rounded-[34px] bg-white/94 p-5 shadow-[0_36px_90px_-54px_rgba(15,23,42,0.3)] backdrop-blur-[8px] sm:p-6">
                <div className="mb-5 flex items-center gap-3 px-1">
                  <SkeletonBlock className="h-3.5 w-12 rounded-full bg-[#dfe7fb]" />
                  <SkeletonBlock className="h-3.5 w-24 rounded-full bg-[#f7d6af]" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SkeletonPreviewCard titleWidth="w-[36%]" />
                  <SkeletonPreviewCard titleWidth="w-[40%]" />
                  <SkeletonPreviewCard titleWidth="w-[34%]" />
                  <SkeletonPreviewCard titleWidth="w-[39%]" />
                </div>
              </div>
            </div>

            <div className="w-full max-w-[980px]">
              <div className="flex items-center gap-4 rounded-[30px] bg-white/94 px-5 py-4 shadow-[0_30px_80px_-52px_rgba(15,23,42,0.28)] backdrop-blur-[8px] sm:px-6">
                <div className="h-11 w-11 animate-pulse rounded-full bg-[#fbe6d0] shadow-[0_16px_30px_-22px_rgba(242,140,40,0.65)]" />
                <SkeletonBlock className="h-4 flex-1 rounded-full bg-[#e4ebfb]" />
                <div className="h-11 w-11 animate-pulse rounded-full bg-[#f7ca92] shadow-[0_16px_30px_-20px_rgba(242,140,40,0.7)]" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RouteTransitionSkeleton({
  variant,
}: {
  variant: RouteTransitionSkeletonKind;
}) {
  return variant === "home" ? <HomeTransitionSkeleton /> : <ChatTransitionSkeleton />;
}
