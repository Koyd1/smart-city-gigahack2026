"use client";

import { useEffect, useRef, useState } from "react";

import {
  LOCALE_DISPLAY_CODES,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  isAppLocale,
  type AppLocale
} from "@/lib/i18n/config";
import { useAppTranslation, useLocale } from "@/lib/i18n/I18nProvider";

export default function LanguageSwitcher() {
  const { t } = useAppTranslation();
  const { locale: current, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const didSyncStoredLocaleRef = useRef(false);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (didSyncStoredLocaleRef.current) {
      return;
    }

    didSyncStoredLocaleRef.current = true;
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isAppLocale(saved) && saved !== current) {
      void setLocale(saved);
    }
  }, [current, setLocale]);

  function applyLocale(next: AppLocale) {
    if (next === current) {
      setOpen(false);
      return;
    }

    setOpen(false);
    void setLocale(next);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("common.languageSwitcher.ariaLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white outline-none ring-0 focus:outline-none focus-visible:outline-none"
      >
        {LOCALE_DISPLAY_CODES[current]}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-40 min-w-[228px] rounded-2xl border border-[#d9dde6] bg-white p-1.5 shadow-[0_10px_24px_-18px_rgba(16,24,40,0.48)] outline-none ring-0">
          {SUPPORTED_LOCALES.map((locale) => {
            const selected = locale === current;
            return (
              <button
                key={locale}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[0.95rem] font-medium transition-colors outline-none ring-0 last:mb-0 focus:outline-none focus-visible:outline-none ${
                  selected
                    ? "bg-[#ead6c4] text-[#2f2f2f]"
                    : "text-[#2f2f2f] hover:bg-[#f6eee7]"
                }`}
                onClick={() => applyLocale(locale)}
              >
                <span className="shrink-0 text-[0.95rem] font-medium tracking-normal">
                  {LOCALE_DISPLAY_CODES[locale]}
                </span>
                <span>{LOCALE_LABELS[locale]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
