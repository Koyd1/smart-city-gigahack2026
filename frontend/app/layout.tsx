import "./globals.css";

import { Inter } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import RouteTransitionProvider from "@/components/navigation/RouteTransitionProvider";
import I18nProvider from "@/lib/i18n/I18nProvider";
import { getServerTranslator } from "@/lib/i18n/server";
import { toHtmlLang } from "@/lib/i18n/config";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CIVIS — Asistentul digital al Primăriei",
  description: "Răspunsuri municipale clare, bilingve și bazate pe documente publice",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getServerTranslator();

  return (
    <html lang={toHtmlLang(locale)}>
      <body className={inter.className}>
        <I18nProvider initialLocale={locale}>
          <RouteTransitionProvider>{children}</RouteTransitionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
