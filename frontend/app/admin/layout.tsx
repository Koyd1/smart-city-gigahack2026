import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AdminTopNav from "@/components/admin/AdminTopNav";
import LogoutButton from "@/components/auth/LogoutButton";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import { auth } from "@/lib/auth";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function AdminRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const { t } = await getServerTranslator();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/chat");
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-6 xl:px-10">
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/admin/knowledge"
                className="flex min-w-0 items-center gap-2 text-lg font-bold text-gray-900 no-underline hover:no-underline"
              >
                <span className="inline-flex items-center justify-center w-10 h-10">
                  <img
                    src="/icons/civis_logo.svg"
                    alt={t("home.title")}
                    className="w-10 h-10 object-contain"
                  />
                </span>
                <span className="truncate">CIVIS</span>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LogoutButton />
              <LanguageSwitcher />
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-lg border border-border px-3 py-2 text-sm font-semibold">
                  Menu
                </summary>
                <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-white p-2 shadow-xl">
                  <AdminTopNav mobile />
                </div>
              </details>
            </div>
          </div>

          <div className="hidden items-center justify-between gap-4 lg:flex">
            <div className="flex min-w-0 items-center gap-5">
              <Link
                href="/admin/knowledge"
                className="flex shrink-0 items-center gap-3 text-xl font-bold text-gray-900 no-underline hover:no-underline"
              >
                <span className="inline-flex items-center justify-center w-10 h-10">
                  <img
                    src="/icons/civis_logo.svg"
                    alt={t("home.title")}
                    className="w-10 h-10 object-contain"
                  />
                </span>
                {t("home.adminCard.title")}
              </Link>
              <div className="min-w-0 overflow-x-auto border-l border-border pl-5">
                <AdminTopNav />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm text-gray-500">{session.user.email}</span>
              <LogoutButton />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-6 sm:py-8 xl:px-10">
        {children}
      </main>
    </>
  );
}
