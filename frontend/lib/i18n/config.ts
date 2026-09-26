export const SUPPORTED_LOCALES = ["md", "ru", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "md";
export const LOCALE_COOKIE_NAME = "peona_locale";
export const LOCALE_STORAGE_KEY = "peona_locale";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  md: "Română",
  ru: "Русский",
  en: "English"
};

export const LOCALE_DISPLAY_CODES: Record<AppLocale, string> = {
  md: "RO",
  ru: "RU",
  en: "EN"
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "md" || value === "ru" || value === "en";
}

export function toHtmlLang(locale: AppLocale): string {
  if (locale === "md") {
    return "ro-MD";
  }

  return locale;
}
