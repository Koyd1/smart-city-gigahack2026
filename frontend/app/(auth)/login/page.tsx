import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import LoginForm from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/card";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import { getServerTranslator } from "@/lib/i18n/server";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { t } = await getServerTranslator();

  async function loginAction(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/admin",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login?error=credentials");
      }
      throw error;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>

      <Card className="w-full max-w-[420px] p-8 text-center shadow-hover">
        <div className="flex justify-center mb-3">
          <img
            src="/icons/hr_assistant_logo.svg"
            alt={t("home.title")}
            className="h-[88px] w-[88px] object-contain"
          />
        </div>
        <h1 className="mb-3 text-2xl font-semibold leading-snug">{t("auth.adminPanelTitle")}</h1>

        <LoginForm loginAction={loginAction} serverError={params.error} />

        <p className="text-sm mt-4">
          <Link href="/chat" className="text-orange-600 no-underline hover:underline">
            {t("common.actions.backToChat")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
