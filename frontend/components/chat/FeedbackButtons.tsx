"use client";

import { useState } from "react";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

export default function FeedbackButtons({
  sessionId,
  messageId,
  initialRating,
  initialComment,
  onSaved
}: {
  sessionId: string;
  messageId: string;
  initialRating?: 1 | -1;
  initialComment?: string | null;
  onSaved?: (payload: { rating: 1 | -1; comment: string | null }) => void;
}) {
  const { t } = useAppTranslation();
  const [rating, setRating] = useState<1 | -1 | undefined>(initialRating);
  const [comment, setComment] = useState(initialComment ?? "");
  const [isNegativeDraft, setIsNegativeDraft] = useState(initialRating === -1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(initialRating !== undefined);

  async function submit(nextRating: 1 | -1, nextComment?: string | null) {
    if (isSaved || busy) {
      return;
    }

    const normalizedComment = nextComment === undefined ? comment.trim() || null : nextComment;
    const previousRating = rating;
    const previousComment = comment;

    // Optimistic UI: mark as saved immediately and rollback on API error.
    setRating(nextRating);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messageId,
          rating: nextRating,
          comment: normalizedComment ?? undefined
        })
      });

      if (!response.ok) {
        throw new Error(t("chat.feedback.submitFailed"));
      }
      setIsSaved(true);
      onSaved?.({ rating: nextRating, comment: normalizedComment });
    } catch (submitError) {
      setRating(previousRating);
      setComment(previousComment);
      setError(t("chat.feedback.submitFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveComment() {
    if (rating !== -1 || isSaved || busy) {
      return;
    }

    const nextComment = comment.trim() || null;

    await submit(-1, nextComment);
  }

  const canRate = !isSaved && !busy;
  const isPositive = rating === 1;
  const isNegative = rating === -1;
  const showNegativeInput = isNegativeDraft || isNegative;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-600 flex-1">
          {t("chat.feedback.intro")}
        </p>
        <div className="flex items-center gap-4 self-start">
          <button
            type="button"
            disabled={!canRate}
            onClick={() => {
              setIsNegativeDraft(false);
              void submit(1, null);
            }}
            title={t("chat.feedback.helpful")}
            className={`rounded-full border border-border bg-white p-2 transition ${
              !canRate && !isPositive
                ? "opacity-40 cursor-not-allowed"
                : "cursor-pointer hover:border-emerald-400"
            }`}
          >
            <svg
              viewBox="-4 -4 48 48"
              className="h-6 w-6 overflow-visible"
              aria-hidden="true"
            >
              <path
                d="M38.695 21.0557C39.535 19.9782 40 18.6579 40 17.2843C40 15.105 38.745 13.0421 36.725 11.8918C36.205 11.5957 35.6129 11.4398 35.01 11.4404H23.02L23.32 5.47509C23.39 4.03352 22.865 2.66476 21.845 1.6212C21.3444 1.10683 20.7405 0.697587 20.0706 0.418748C19.4006 0.139909 18.6789 -0.00259683 17.95 3.58216e-05C15.35 3.58216e-05 13.05 1.69886 12.36 4.1306L8.065 19.2258H1.6C0.715 19.2258 0 19.9199 0 20.779V38.4468C0 39.3059 0.715 40 1.6 40H31.665C32.125 40 32.575 39.9126 32.99 39.7379C35.37 38.7526 36.905 36.4956 36.905 33.991C36.905 33.3795 36.815 32.7776 36.635 32.1951C37.475 31.1176 37.94 29.7974 37.94 28.4237C37.94 27.8122 37.85 27.2103 37.67 26.6278C38.51 25.5503 38.975 24.2301 38.975 22.8565C38.965 22.2449 38.875 21.6382 38.695 21.0557ZM3.6 36.5053V22.7206H7.65V36.5053H3.6ZM35.42 19.3715L34.325 20.2937L35.02 21.5265C35.249 21.9326 35.3677 22.3887 35.365 22.8516C35.365 23.6525 35.005 24.4145 34.385 24.9387L33.29 25.861L33.985 27.0938C34.214 27.4999 34.3327 27.9559 34.33 28.4189C34.33 29.2198 33.97 29.9818 33.35 30.506L32.255 31.4282L32.95 32.6611C33.179 33.0672 33.2977 33.5232 33.295 33.9862C33.295 35.0734 32.635 36.0539 31.615 36.5004H10.85V22.5652L15.825 5.06738C15.9533 4.61889 16.2287 4.22322 16.6094 3.94031C16.9902 3.65741 17.4555 3.50269 17.935 3.49961C18.315 3.49961 18.69 3.60639 18.99 3.82481C19.485 4.18399 19.75 4.72761 19.72 5.30521L19.24 14.9351H34.96C35.85 15.4642 36.4 16.3573 36.4 17.2843C36.4 18.0852 36.04 18.8424 35.42 19.3715Z"
                fill={isPositive ? "#20C25E" : "none"}
                stroke="#20C25E"
                strokeWidth="2"
              />
            </svg>
          </button>
          <button
            type="button"
            disabled={!canRate}
            onClick={() => {
              setRating(-1);
              setIsNegativeDraft(true);
              setError(null);
            }}
            title={t("chat.feedback.notHelpful")}
            className={`rounded-full border border-border bg-white p-2 transition ${
              !canRate && !isNegative
                ? "opacity-40 cursor-not-allowed"
                : "cursor-pointer hover:border-red-400"
            }`}
          >
            <svg
              viewBox="-4 -4 48 48"
              className="h-6 w-6 overflow-visible"
              aria-hidden="true"
            >
              <path
                d="M1.305 18.9443C0.464996 20.0218 0 21.3421 0 22.7157C0 24.895 1.255 26.9579 3.275 28.1082C3.79503 28.4043 4.38711 28.5602 4.99 28.5596H16.98L16.68 34.5249C16.61 35.9665 17.135 37.3352 18.155 38.3788C18.6556 38.8932 19.2595 39.3024 19.9294 39.5813C20.5994 39.8601 21.3211 40.0026 22.05 40C24.65 40 26.95 38.3011 27.64 35.8694L31.935 20.7742H38.4C39.285 20.7742 40 20.0801 40 19.221V1.55321C40 0.694088 39.285 0 38.4 0H8.335C7.875 0 7.425 0.087368 7.01 0.262104C4.63 1.24742 3.095 3.50443 3.095 6.00897C3.095 6.62055 3.185 7.22242 3.365 7.80487C2.525 8.88241 2.06 10.2026 2.06 11.5763C2.06 12.1878 2.15 12.7897 2.33 13.3722C1.49 14.4497 1.025 15.7699 1.025 17.1435C1.035 17.7551 1.125 18.3618 1.305 18.9443ZM36.4 3.49472V17.2794H32.35V3.49472H36.4ZM4.58 20.6285L5.675 19.7063L4.98 18.4735C4.75103 18.0674 4.6323 17.6113 4.635 17.1484C4.635 16.3475 4.995 15.5855 5.615 15.0613L6.71 14.139L6.015 12.9062C5.78603 12.5001 5.6673 12.0441 5.67 11.5811C5.67 10.7802 6.03 10.0182 6.65 9.49398L7.745 8.57177L7.05 7.33891C6.82103 6.93279 6.7023 6.47679 6.705 6.01383C6.705 4.92658 7.365 3.94612 8.385 3.49957H29.15V17.4348L24.175 34.9326C24.0467 35.3811 23.7713 35.7768 23.3906 36.0597C23.0098 36.3426 22.5445 36.4973 22.065 36.5004C21.685 36.5004 21.31 36.3936 21.01 36.1752C20.515 35.816 20.25 35.2724 20.28 34.6948L20.76 25.0649H5.04C4.15 24.5358 3.6 23.6427 3.6 22.7157C3.6 21.9148 3.96 21.1576 4.58 20.6285Z"
                fill={isNegative ? "#EB2222" : "none"}
                stroke="#EB2222"
                strokeWidth="2"
              />
            </svg>
          </button>
          {busy ? <span className="text-xs text-slate-400">{t("chat.feedback.saving")}</span> : null}
        </div>
      </div>

      <div
        className={`grid transition-all duration-250 ease-out ${
          showNegativeInput ? "mt-3 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className={`flex justify-end transition duration-250 ${showNegativeInput ? "translate-y-0" : "-translate-y-2"}`}>
          <div className="w-full max-w-full sm:max-w-[360px]">
            <div className="relative">
              <input
                placeholder={t("chat.feedback.commentPlaceholder")}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={600}
                disabled={busy || isSaved}
                className="w-full rounded-full border border-border bg-card px-5 py-2.5 pr-12 text-sm text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)] outline-none placeholder:text-slate-400 focus:border-[#7bc4f4] focus:ring-2 focus:ring-[#7bc4f4]/40"
              />
              <button
                type="button"
                disabled={busy || isSaved}
                onClick={() => void saveComment()}
                className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition ${
                  busy || isSaved ? "opacity-40 cursor-not-allowed" : "hover:text-slate-600"
                }`}
                aria-label={t("chat.feedback.submitComment")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M4 12l16-6-6 16-2.2-6.1L4 12Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
