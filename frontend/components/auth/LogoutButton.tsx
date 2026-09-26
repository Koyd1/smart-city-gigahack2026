"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

type LogoutButtonProps = {
  callbackUrl?: string;
};

export default function LogoutButton({ callbackUrl = "/login" }: LogoutButtonProps) {
  const { t } = useAppTranslation();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) {
      return;
    }

    setBusy(true);
    try {
      const result = await signOut({ redirect: false, callbackUrl });
      window.location.replace(result?.url ?? callbackUrl);
    } catch {
      window.location.replace(callbackUrl);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className="whitespace-nowrap px-5"
      type="button"
      disabled={busy}
      onClick={() => void handleLogout()}
    >
      {busy ? t("common.actions.loggingOut", "Logging out...") : t("common.actions.logout")}
    </Button>
  );
}
