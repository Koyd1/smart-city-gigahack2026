"use client";

import { useEffect, useState } from "react";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

type Props = {
  sessionId: string;
  initialPersistent: boolean;
  initialExpiresAt?: string;
  canCreateNewSession?: boolean;
};

export default function SessionToggle({
  sessionId,
  initialExpiresAt,
  canCreateNewSession = false
}: Props) {
  const { t } = useAppTranslation();
  const [expiresAt, setExpiresAt] = useState<string | undefined>(initialExpiresAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function recoverToFreshSession() {
    window.location.replace(`/chat?renew=${Date.now()}`);
  }

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toISOString().replace("T", " ").replace(".000Z", " UTC")
    : t("chat.session.unknownExpiry");

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/session/mode?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: "no-store"
      });
      if (response.status === 401 || response.status === 404) {
        recoverToFreshSession();
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as {
        expiresAt: string;
      };
      setExpiresAt(data.expiresAt);
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [sessionId]);

  async function terminateNow() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/session/terminate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          recoverToFreshSession();
          return;
        }
        throw new Error(t("chat.session.terminateFailed"));
      }

      recoverToFreshSession();
    } catch (terminateError) {
      setError(t("chat.session.terminateFailed"));
      setBusy(false);
    }
  }

  const canAct = canCreateNewSession && !busy;

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={!canAct}
        onClick={() => void terminateNow()}
        title={
          !canCreateNewSession
            ? t("chat.session.hintNeedsAnswer")
            : t("chat.session.hintNewSession")
        }
        className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all ${
          canAct
            ? "border-transparent bg-[#087dbb] text-white shadow-[0_10px_24px_rgba(8,125,187,0.28)]"
            : "border-[#b8dfff] bg-[#eff8ff] text-[#08679a] cursor-not-allowed"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span>{t("chat.session.new")}</span>
      </button>
      <span className="sr-only">{t("chat.session.modeScreenReader", { expiresLabel })}</span>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
