"use client";

import { createInstance, type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/config";
import { resources } from "@/lib/i18n/resources";

export function createAppI18n(locale: AppLocale = DEFAULT_LOCALE): I18nInstance {
  const instance = createInstance();

  void instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: Object.keys(resources),
    defaultNS: "translation",
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    },
    initImmediate: false
  });

  return instance;
}
