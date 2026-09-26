import Link from "next/link";

import AppHeader from "@/components/shared/AppHeader";
import TransitionLink from "@/components/navigation/TransitionLink";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function HomePage() {
  const { t } = await getServerTranslator();

  return (
    <>
      <AppHeader />

      <main className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="text-center pt-16 pb-12">
          <div className="mb-6 flex justify-center">
            <img
              src="/icons/hr_assistant_logo.svg"
              alt={t("home.title")}
              className="h-[104px] w-[104px] object-contain"
            />
          </div>

          <div className="mx-auto mb-4 w-fit rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
            {t("home.eyebrow")}
          </div>
          <h1 className="text-[3.25rem] font-bold leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[3.75rem]">{t("home.title")}</h1>
          <p className="max-w-[600px] mx-auto mt-4 mb-12 text-gray-500">
            {t("home.description")}
          </p>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-8 max-w-[820px] mx-auto">
            <Card hover className="flex h-full flex-col text-left p-8">
              <span className="inline-flex items-center justify-center w-11 h-11 bg-[#e4f4fc] rounded-lg mb-5">
                <svg
                  width="18"
                  height="17"
                  viewBox="0 0 35 33"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="shrink-0 opacity-90"
                >
                  <path
                    d="M5.25 0H29.75C31.1424 0 32.4777 0.521509 33.4623 1.4498C34.4469 2.37809 35 3.63713 35 4.94993V21.4497C35 22.7625 34.4469 24.0215 33.4623 24.9498C32.4777 25.8781 31.1424 26.3996 29.75 26.3996H9.4675L2.9925 32.521C2.82898 32.674 2.63505 32.795 2.42184 32.8771C2.20862 32.9592 1.98031 33.0008 1.75 32.9995C1.52044 33.0051 1.29269 32.9599 1.085 32.8675C0.765419 32.7438 0.491844 32.5336 0.298763 32.2634C0.105679 31.9933 0.00172424 31.6753 0 31.3496V4.94993C0 3.63713 0.553123 2.37809 1.53769 1.4498C2.52225 0.521509 3.85761 0 5.25 0ZM3.5 27.3731L7.5075 23.5782C7.67102 23.4253 7.86495 23.3043 8.07816 23.2222C8.29138 23.14 8.51969 23.0984 8.75 23.0997H29.75C30.2141 23.0997 30.6592 22.9258 30.9874 22.6164C31.3156 22.307 31.5 21.8873 31.5 21.4497V4.94993C31.5 4.51233 31.3156 4.09265 30.9874 3.78322C30.6592 3.47379 30.2141 3.29995 29.75 3.29995H5.25C4.78587 3.29995 4.34075 3.47379 4.01256 3.78322C3.68437 4.09265 3.5 4.51233 3.5 4.94993V27.3731Z"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    fill="#087DBB"
                  />
                </svg>
              </span>
              <h3 className="text-xl font-semibold mb-2.5">{t("home.chatCard.title")}</h3>
              <p className="mb-7 flex-1 text-sm text-gray-500">
                {t("home.chatCard.description")}
              </p>
              <TransitionLink href="/chat" skeleton="chat" className={buttonVariants({ fullWidth: true })}>
                {t("common.actions.startConversation")}
              </TransitionLink>
            </Card>

            <Card hover className="flex h-full flex-col text-left p-8">
              <span className="inline-flex items-center justify-center w-11 h-11 bg-[#e4f4fc] rounded-lg mb-5">
                <img src="/icons/logo_mech.svg" alt="" width={22} height={22} />
              </span>
              <h3 className="text-xl font-semibold mb-2.5">{t("home.adminCard.title")}</h3>
              <p className="mb-7 flex-1 text-sm text-gray-500">
                {t("home.adminCard.description")}
              </p>
              <Link href="/login" className={buttonVariants({ variant: "secondary", fullWidth: true })}>
                {t("common.actions.accessAdmin")}
              </Link>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
