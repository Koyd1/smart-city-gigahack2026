import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        {brandTransitionSkeleton ? (
          <TransitionLink href="/" skeleton={brandTransitionSkeleton} className={brandClassName}>
            {brandContent}
          </TransitionLink>
        ) : (
          <Link href="/" className={brandClassName}>
            {brandContent}
          </Link>
        )}
        <a
          href="https://eu.chisinau.md/"
          target="_blank"
          rel="noreferrer"
          aria-label={t("common.actions.reportIssue")}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-border-strong bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07549a] focus-visible:ring-offset-2 sm:text-[0.8125rem]"
        >
          <span aria-hidden="true" className="tracking-[-0.02em]">
            <span className="text-[#2db34a]">EU.</span>{" "}
            <span className="text-[#0b1d33]">CHISINAU</span>
          </span>
          <ExternalLink aria-hidden="true" size={13} strokeWidth={2.5} className="text-[#0b1d33]" />
        </a>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {actions}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
