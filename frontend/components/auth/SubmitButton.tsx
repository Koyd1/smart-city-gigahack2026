"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

type SubmitButtonProps = {
  children: ReactNode;
  pendingText?: string;
};

export default function SubmitButton({
  children,
  pendingText,
}: SubmitButtonProps) {
  const { t } = useAppTranslation();
  const { pending } = useFormStatus();
  const resolvedPendingText = pendingText ?? t("common.states.loading", "Se încarcă...");

  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? resolvedPendingText : children}
    </Button>
  );
}
