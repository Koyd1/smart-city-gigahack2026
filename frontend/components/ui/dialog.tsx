"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useAppTranslation } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  panelClassName?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  panelClassName
}: DialogProps) {
  const { t } = useAppTranslation();
  const titleId = React.useId();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto px-4 py-8 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="fixed inset-0 bg-[#101828]/20 backdrop-blur-[1.5px]" aria-hidden="true" />
      <div
        className={cn(
          "relative mx-auto my-auto w-full max-w-[720px] overflow-hidden rounded-[24px] border border-[#f2ddcc] bg-[linear-gradient(180deg,#fff9f5_0%,#fffdfb_24%,#ffffff_44%)] shadow-[0_30px_80px_-40px_rgba(16,24,40,0.45)] ring-1 ring-[#fff7f2] animate-[dialog-pop_180ms_ease-out]",
          panelClassName
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(247,215,186,0.2)_0%,rgba(247,215,186,0.08)_52%,rgba(255,255,255,0)_100%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-40 w-[140%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(247,215,186,0.72)_0%,rgba(247,215,186,0.22)_38%,rgba(255,255,255,0)_76%)] blur-2xl"
          aria-hidden="true"
        />

        <div className="relative border-b border-[#f2ede7] px-5 pb-4 pt-5 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="m-0 text-[1.35rem] font-semibold tracking-[-0.02em] text-[#101828]"
              >
                {title}
              </h2>
              {description ? (
                <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-[#667085]">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t("common.accessibility.closeDialog")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eadfce] bg-white text-lg text-[#667085] transition hover:border-[#e4cfb7] hover:bg-[#fff7f1] hover:text-[#101828]"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className="relative max-h-[min(78vh,720px)] overflow-y-auto px-5 py-5 md:px-6">
          {children}
        </div>
      </div>

      <style jsx>{`
        @keyframes dialog-pop {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
