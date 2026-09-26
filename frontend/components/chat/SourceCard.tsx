"use client";

import { useAppTranslation } from "@/lib/i18n/I18nProvider";

export type ChatSource = {
  fileId?: string;
  filename?: string;
  similarity?: number;
  snippet?: string;
};

export default function SourceCard({
  source,
  href
}: {
  source: ChatSource;
  href?: string;
}) {
  const { t } = useAppTranslation();
  const filename = source.filename ?? t("chat.message.unknown");

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          {t("chat.message.source")}
        </span>
        {href ? (
          <a
            href={href}
            download
            className="text-sm font-semibold text-slate-800 decoration-slate-300 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            {filename}
          </a>
        ) : (
          <span className="text-sm font-semibold text-slate-800">{filename}</span>
        )}
        {typeof source.similarity === "number" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            {t("chat.message.similarity")} {source.similarity.toFixed(3)}
          </span>
        ) : null}
      </div>
      {source.snippet ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap break-words hyphens-auto">
          {source.snippet}
        </p>
      ) : null}
    </div>
  );
}
