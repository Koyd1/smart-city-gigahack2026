import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isAppLocale,
  type AppLocale
} from "@/lib/i18n/config";
import { resources } from "@/lib/i18n/resources";

type TranslateParams = Record<string, string | number>;

function lookupTranslation(locale: AppLocale, key: string): string | null {
  const segments = key.split(".");
  let current: unknown = resources[locale].translation;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, token: string) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

export async function resolveServerLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? null;

  if (isAppLocale(raw)) {
    return raw;
  }

  return DEFAULT_LOCALE;
}

export async function getServerTranslator(
  locale?: AppLocale
): Promise<{
  locale: AppLocale;
  t: (key: string, params?: TranslateParams) => string;
}> {
  const resolvedLocale = locale ?? (await resolveServerLocale());

  return {
    locale: resolvedLocale,
    t: (key: string, params?: TranslateParams) => {
      const localized =
        lookupTranslation(resolvedLocale, key) ??
        lookupTranslation(DEFAULT_LOCALE, key) ??
        key;

      return interpolate(localized, params);
    }
  };
}
