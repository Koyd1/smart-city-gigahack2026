"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

import {
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  toHtmlLang,
  type AppLocale
} from "@/lib/i18n/config";
import { createAppI18n } from "@/lib/i18n/client";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function persistLocale(locale: AppLocale) {
  document.documentElement.lang = toHtmlLang(locale);
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export default function I18nProvider({
  initialLocale,
  children
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);
  const [i18nInstance] = useState(() => createAppI18n(initialLocale));

  useEffect(() => {
    setLocaleState(initialLocale);
    void i18nInstance.changeLanguage(initialLocale);
    if (typeof window !== "undefined") {
      persistLocale(initialLocale);
    }
  }, [i18nInstance, initialLocale]);

  const setLocale = useCallback(
    async (nextLocale: AppLocale) => {
      if (nextLocale === locale) {
        return;
      }

      setLocaleState(nextLocale);
      await i18nInstance.changeLanguage(nextLocale);
      persistLocale(nextLocale);
      router.refresh();
    },
    [i18nInstance, locale, router]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale
    }),
    [locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within I18nProvider");
  }

  return context;
}

export function useAppTranslation() {
  return useTranslation();
}
