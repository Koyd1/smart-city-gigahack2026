import Link from "next/link";
import type { ReactNode } from "react";

import AppHeader from "@/components/shared/AppHeader";
import LogoutButton from "@/components/auth/LogoutButton";
import { auth } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function UserLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const { t } = await getServerTranslator();

  return (
    <>
      <AppHeader
        brandTransitionSkeleton="home"
        actions={
          session ? (
            <>
              <span className="text-sm text-gray-500">{session.user.email}</span>
              <LogoutButton />
              {session.user.role === "ADMIN" ? (
                <Link href="/admin" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  {t("common.actions.admin")}
                </Link>
              ) : null}
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              {t("common.actions.login")}
            </Link>
          )
        }
      />
      <main className="max-w-[960px] mx-auto px-6 py-6">
        {children}
      </main>
    </>
  );
}
