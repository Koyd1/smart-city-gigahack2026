import Link from "next/link";
import type { ReactNode } from "react";

import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import TransitionLink from "@/components/navigation/TransitionLink";
import { getServerTranslator } from "@/lib/i18n/server";

type AppHeaderProps = {
  actions?: ReactNode;
  brandTransitionSkeleton?: "home" | "chat";
};

export default async function AppHeader({
  actions,
  brandTransitionSkeleton,
}: AppHeaderProps) {
  const { t } = await getServerTranslator();
  const brandClassName =
    "flex items-center gap-2 text-xl font-bold text-gray-900 no-underline hover:no-underline";
  const brandContent = (
    <>
      <span className="inline-flex items-center justify-center w-10 h-10">
        <img
          src="/icons/civis_logo.svg"
          alt={t("home.title")}
          className="w-10 h-10 object-contain"
        />
      </span>
      <span className="hidden sm:inline">{t("common.brand")}</span>
    </>
  );

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 sm:px-6">
      {brandTransitionSkeleton ? (
        <TransitionLink href="/" skeleton={brandTransitionSkeleton} className={brandClassName}>
          {brandContent}
        </TransitionLink>
      ) : (
        <Link href="/" className={brandClassName}>
          {brandContent}
        </Link>
      )}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {actions}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
