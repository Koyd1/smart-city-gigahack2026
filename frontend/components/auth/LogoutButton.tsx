"use client";

import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
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
      className="h-9 w-9 p-0"
      type="button"
      disabled={busy}
      onClick={() => void handleLogout()}
      aria-label={t("common.actions.logout")}
      title={t("common.actions.logout")}
    >
      {busy ? (
        <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
      ) : (
        <LogOut aria-hidden="true" size={17} />
      )}
    </Button>
  );
}
